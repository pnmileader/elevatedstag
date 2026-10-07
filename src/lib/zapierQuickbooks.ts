// Turns what Zapier sends from QuickBooks Online into the same rows the Settings → Import
// screens produce, so new customers and sales go through the exact same matching and
// de-duplication as a manual import.
//
// Two payload shapes are accepted:
//   1. QuickBooks' own objects. A Webhooks by Zapier POST with the Data field left empty
//      sends the trigger's raw output: a Customer, Invoice or SalesReceipt (Line[] etc.),
//      sometimes wrapped ({ Invoice: {...} }) and sometimes with keys flattened by Zapier
//      ("CustomerRef__name"). Keys are matched case-insensitively.
//   2. A simple explicit shape, for a Zap that maps fields by hand:
//        customer:  { name, first_name, last_name, email, phone, company, street, city, state, zip, notes }
//        sale:      { customer, date, invoice_number, lines: [{ product, description, quantity, amount }] }
//      where each line field may instead be one text value joined with LINE_SEPARATOR
//      (Formatter → Utilities → Line-item to Text), because Zapier flattens line items.

import type { IncomingPurchaseRow } from '@/lib/purchaseImport'
import type { IncomingClientRow } from '@/lib/importRunners'

export const LINE_SEPARATOR = '|~|'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Read a dotted path, matching keys case-insensitively and accepting Zapier's "a__b" flattening. */
export function pick(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (let i = 0; i < parts.length; i++) {
    if (!isObj(cur)) return undefined
    const keys = Object.keys(cur)
    const want = parts[i].toLowerCase()
    const direct = keys.find((k) => k.toLowerCase() === want)
    if (direct !== undefined) { cur = cur[direct]; continue }
    const flat = parts.slice(i).join('__').toLowerCase()
    const flatKey = keys.find((k) => k.toLowerCase() === flat)
    return flatKey !== undefined ? cur[flatKey] : undefined
  }
  return cur
}

const text = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

const first = (obj: unknown, ...paths: string[]): string | undefined => {
  for (const p of paths) {
    const v = text(pick(obj, p))
    if (v) return v
  }
  return undefined
}

/** Unwrap { Customer: {...} } / { Invoice: {...} } / { data: {...} } envelopes. */
function unwrap(body: unknown, names: string[]): Obj {
  if (!isObj(body)) return {}
  for (const n of [...names, 'data', 'payload']) {
    const inner = pick(body, n)
    if (isObj(inner)) return unwrap(inner, names)
  }
  return body
}

// ─── Customers ──────────────────────────────────────────────────────────────

export function customerFromZapier(body: unknown): IncomingClientRow | null {
  const c = unwrap(body, ['Customer', 'customer'])
  const row: IncomingClientRow = {
    first_name: first(c, 'GivenName', 'first_name', 'firstName'),
    last_name: first(c, 'FamilyName', 'last_name', 'lastName'),
    full_name: first(c, 'DisplayName', 'FullyQualifiedName', 'name', 'full_name'),
    email: first(c, 'PrimaryEmailAddr.Address', 'email'),
    phone: first(c, 'PrimaryPhone.FreeFormNumber', 'Mobile.FreeFormNumber', 'AlternatePhone.FreeFormNumber', 'phone'),
    company: first(c, 'CompanyName', 'company'),
    billing_street: first(c, 'BillAddr.Line1', 'street', 'billing_street'),
    billing_city: first(c, 'BillAddr.City', 'city', 'billing_city'),
    billing_state: first(c, 'BillAddr.CountrySubDivisionCode', 'state', 'billing_state'),
    billing_zip: first(c, 'BillAddr.PostalCode', 'zip', 'billing_zip'),
    shipping_street: first(c, 'ShipAddr.Line1', 'shipping_street'),
    shipping_city: first(c, 'ShipAddr.City', 'shipping_city'),
    shipping_state: first(c, 'ShipAddr.CountrySubDivisionCode', 'shipping_state'),
    shipping_zip: first(c, 'ShipAddr.PostalCode', 'shipping_zip'),
    notes: first(c, 'Notes', 'notes'),
  }
  // A company name repeated as the display name is not a person's name.
  if (row.full_name && row.company && row.full_name === row.company && (row.first_name || row.last_name)) row.full_name = undefined
  if (!row.first_name && !row.last_name && !row.full_name && !row.email && !row.phone) return null
  return row
}

// ─── Sales (invoices / sales receipts) ────────────────────────────────────────

export type ZapierSale = { customer: string | null; rows: IncomingPurchaseRow[] }

/** Lines that aren't goods: subtotals, discounts, tax, and other bookkeeping lines. */
const NON_ITEM_DETAIL = /^(SubTotalLineDetail|DiscountLineDetail|TaxLineDetail|DescriptionOnly)$/i

function qboLines(lines: unknown[]): Array<Omit<IncomingPurchaseRow, 'customer' | 'date' | 'invoice_id'>> {
  const out: Array<Omit<IncomingPurchaseRow, 'customer' | 'date' | 'invoice_id'>> = []
  for (const line of lines) {
    if (!isObj(line)) continue
    const detailType = text(pick(line, 'DetailType')) || ''
    if (/^GroupLineDetail$/i.test(detailType)) {
      const inner = pick(line, 'GroupLineDetail.Line')
      if (Array.isArray(inner)) out.push(...qboLines(inner))
      continue
    }
    if (NON_ITEM_DETAIL.test(detailType)) continue
    const product = first(line, 'SalesItemLineDetail.ItemRef.name', 'ItemRef.name', 'product', 'item')
    if (!product) continue
    out.push({
      product,
      description: first(line, 'Description', 'description') ?? null,
      quantity: first(line, 'SalesItemLineDetail.Qty', 'Qty', 'quantity') ?? null,
      amount: first(line, 'Amount', 'amount') ?? null,
      line_id: first(line, 'LineNum', 'Id', 'line_id') ?? null,
    })
  }
  return out
}

function splitField(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => text(x) ?? '')
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : ''
  return s === '' ? [] : s.split(LINE_SEPARATOR).map((x) => x.trim())
}

/** Explicit shape with line fields as parallel arrays or LINE_SEPARATOR-joined text. */
function explicitLines(s: Obj): Array<Omit<IncomingPurchaseRow, 'customer' | 'date' | 'invoice_id'>> | { error: string } {
  const products = splitField(pick(s, 'product') ?? pick(s, 'products'))
  if (products.length === 0) return []
  const descriptions = splitField(pick(s, 'description') ?? pick(s, 'descriptions'))
  const quantities = splitField(pick(s, 'quantity') ?? pick(s, 'quantities'))
  const amounts = splitField(pick(s, 'amount') ?? pick(s, 'amounts'))
  for (const [name, list] of [['description', descriptions], ['quantity', quantities], ['amount', amounts]] as const) {
    if (list.length > 0 && list.length !== products.length) {
      return { error: `${products.length} products but ${list.length} ${name} values — the line items don't line up` }
    }
  }
  return products.map((product, i) => ({
    product,
    description: descriptions[i] || null,
    quantity: quantities[i] || null,
    amount: amounts[i] || null,
    line_id: String(i + 1),
  }))
}

/**
 * The QuickBooks API names the customer in CustomerRef.name, but Zapier's invoice and sales
 * receipt triggers replace that with the whole customer record under "Customer".
 */
function customerName(s: Obj): string | undefined {
  const named = first(s, 'CustomerRef.name', 'Customer.DisplayName', 'Customer.FullyQualifiedName', 'Customer.name', 'customer', 'customer_name')
  if (named) return named
  const given = [first(s, 'Customer.GivenName'), first(s, 'Customer.FamilyName')].filter(Boolean).join(' ')
  return given || first(s, 'Customer.CompanyName')
}

/** Zapier sends line items as "Line" (QuickBooks' own) and sometimes also as "Lines". */
function rawLines(s: Obj): unknown[] | undefined {
  for (const key of ['Line', 'Lines']) {
    const v = pick(s, key)
    if (Array.isArray(v) && v.length > 0) return v
    if (isObj(v)) return [v]
  }
  return undefined
}

export function saleFromZapier(body: unknown): ZapierSale | { error: string } {
  const s = unwrap(body, ['Invoice', 'SalesReceipt', 'invoice', 'sales_receipt', 'sale'])
  const customer = customerName(s) ?? null
  const date = first(s, 'TxnDate', 'date', 'transaction_date') ?? null
  // The sales report's "Num" column is QuickBooks' DocNumber, so manual imports and Zapier agree.
  const invoiceId = first(s, 'DocNumber', 'invoice_number', 'num', 'number') ?? null

  let lines: Array<Omit<IncomingPurchaseRow, 'customer' | 'date' | 'invoice_id'>>
  const raw = rawLines(s)
  if (raw) {
    lines = qboLines(raw)
    // Lines we can't read at all (no DetailType) mean the payload shape changed: fail loudly
    // instead of reporting a sale with nothing in it.
    const unreadable = raw.find((l) => isObj(l) && !text(pick(l, 'DetailType')) && !first(l, 'ItemRef.name', 'product', 'item'))
    if (lines.length === 0 && unreadable) {
      return { error: `Couldn't read the line items (line keys: ${Object.keys(unreadable as Obj).slice(0, 20).join(', ')})` }
    }
  } else {
    const explicit = explicitLines(s)
    if ('error' in explicit) return explicit
    lines = explicit
  }

  if (!customer) return { error: 'No customer name in the payload' }
  return { customer, rows: lines.map((l) => ({ ...l, customer, date, invoice_id: invoiceId })) }
}
