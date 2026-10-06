// Planning logic for the QuickBooks purchase-history import.
//
// Pure: takes the parsed report rows + what is already in the database and
// returns the inserts / updates to perform. The API route just executes the
// plan, so everything that decides "is this line new?" is unit-testable here.
//
// Three problems this replaces:
//   1. Missing line items. Lines were de-duplicated on
//      (client, invoice, product, date). An invoice with eight
//      "CSHT - Custom Shirt" lines in different fabrics collapsed to ONE shirt.
//      Lines are now matched on product + description, and N identical lines
//      on an invoice need N rows.
//   2. Line totals stored as the price. 3 jeans at $225 showed as $675. We now
//      store the per-item price (Amount / Quantity) and keep the quantity.
//   3. Re-importing could not repair earlier imports. Matching rows are now
//      updated in place (price / quantity), so importing the same or a longer
//      report fixes old data instead of duplicating it. Status, ETA, swatches
//      and anything else Katie edited on an order are left untouched.

import { parseInvoiceLineItem, type GarmentType } from './quickbooks'

export type IncomingPurchaseRow = {
  customer?: string | null
  date?: string | null
  product?: string | null
  description?: string | null
  quantity?: string | number | null
  amount?: string | number | null
  invoice_id?: string | null
  line_id?: string | null
}

export type ImportClient = { id: string; first_name: string | null; last_name: string | null }

export type ExistingPurchaseRow = {
  id: string
  kind: 'custom' | 'ready_made'
  client_id: string
  invoice_id: string | null
  date: string | null
  product: string // garment_type (custom) or product_name (ready-made)
  description: string // fabric_name (custom) or description (ready-made)
  price: number | null
  quantity: number | null
}

export type PlannedInsert =
  | { kind: 'custom'; row: number; payload: Record<string, string | number | null> }
  | { kind: 'ready_made'; row: number; payload: Record<string, string | number | null> }

export type PlannedUpdate = {
  kind: 'custom' | 'ready_made'
  id: string
  patch: Record<string, number>
}

export type ImportPlan = {
  inserts: PlannedInsert[]
  updates: PlannedUpdate[]
  unchanged: number
  skipped: number
  serviceLines: number
  discountLines: number
  outOfScopeLines: number
  refundLines: number
  unmatched: Array<{ row: number; customer: string }>
  needsReview: Array<{ row: number; customer: string; product: string; description: string }>
  lastPurchaseByClient: Map<string, string>
}

export const GARMENT_DB_MAP: Record<GarmentType, string> = {
  suit: 'Suit',
  jacket: 'Blazer',
  pant: 'Pant',
  shirt: 'Custom Shirt',
  vest: 'Vest',
  sport_coat: 'Sport Coat',
  other: 'Other',
}

const READY_MADE_CATEGORY: Record<string, string> = {
  Magnanni: 'shoes',
  'Johnston & Murphy': 'shoes',
  '34 Heritage': 'jeans',
  'Blue Delta': 'jeans',
  Paige: 'jeans',
  Liverpool: 'jeans',
  '7Diamonds': 'other',
  'Georg Roth': 'other', // tees / long sleeves — the CRM has no shirt category
  Sene: 'other',
  Accessory: 'accessories',
}

/** A custom line with a quantity becomes that many garments. Guard against typos like qty 250. */
const MAX_GARMENTS_PER_LINE = 25
/** Imported history older than this is treated as already delivered (see dashboard "In Progress"). */
const ASSUME_DELIVERED_AFTER_DAYS = 90

export function clean(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function parseDate(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  // QBO format is MM/DD/YYYY — parse explicitly so it works regardless of locale.
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  const s = String(v).replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/**
 * Split a QuickBooks customer name into first / last, the same way the client
 * importer splits a "Full Name" column: "Last, First" -> First + Last, otherwise
 * the first word is the first name and the rest is the last name.
 *
 * QBO display names can also be "Company (Person)", e.g. "Acme Corp (John Smith)".
 * When the parenthetical holds a name of two or more words, that is the person
 * and the outer text is the company. A one-word parenthetical ("John Smith (Acme)")
 * is treated as the company and left out of the name.
 */
export function parseCustomerName(name: string): { first: string; last: string; company: string | null } {
  let trimmed = name.trim().replace(/\s+/g, ' ')
  let company: string | null = null
  const paren = trimmed.match(/^(.*?)\s*\(([^()]+)\)$/)
  if (paren && paren[1].trim() && paren[2].trim()) {
    const outer = paren[1].trim()
    const inner = paren[2].trim()
    if (inner.split(' ').length >= 2) {
      trimmed = inner
      company = outer
    } else {
      trimmed = outer
      company = inner
    }
  }
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map((p) => p.trim())
    return { first: first || '', last: last || '', company }
  }
  const parts = trimmed.split(' ')
  if (parts.length === 1) return { first: parts[0], last: '', company }
  return { first: parts[0], last: parts.slice(1).join(' '), company }
}

export function splitCustomerName(name: string): { first: string; last: string } {
  const { first, last } = parseCustomerName(name)
  return { first, last }
}

/** price = line Amount / Qty, to the cent. */
export function unitPrice(amount: number | null, quantity: number): number | null {
  if (amount === null) return null
  if (!(quantity > 0)) return amount
  return Math.round((amount / quantity) * 100) / 100
}

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const money = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(Number(n) * 100) / 100)

/**
 * "Andrew S. Cohen" -> "andrew cohen": first word of the first name + last word of
 * the last name, punctuation dropped. Two names with the same key differ only in
 * middle names / initials. null when there is no first AND last word to compare.
 */
function relaxedKey(first: string | null | undefined, last: string | null | undefined): string | null {
  const words = `${first || ''} ${last || ''}`.toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  return `${words[0]} ${words[words.length - 1]}`
}

/**
 * Index of CRM clients for matching QuickBooks customer names. `add` registers a
 * client the caller is about to create, so later names match it too.
 *
 * Match order (never guesses between two clients):
 *   1. exact first + last name
 *   2. a one-word name against first-name-only clients
 *   3. same first + last word, ignoring middle names / initials on either side
 *      ("Andrew S Cohen" <-> "Andrew Cohen"), only when exactly ONE client fits
 *   4. the last name alone, only when exactly one client has it
 */
export function createClientIndex(clients: ImportClient[] = []) {
  const byName = new Map<string, ImportClient>()
  const byLast = new Map<string, ImportClient[]>()
  const bySingle = new Map<string, ImportClient>()
  const byRelaxed = new Map<string, ImportClient[]>()

  const add = (c: ImportClient) => {
    const first = norm(c.first_name)
    const last = norm(c.last_name)
    if (first && last) byName.set(`${first} ${last}`, c)
    if (first && !last) bySingle.set(first, c)
    if (last) byLast.set(last, [...(byLast.get(last) || []), c])
    const relaxed = relaxedKey(c.first_name, c.last_name)
    if (relaxed) byRelaxed.set(relaxed, [...(byRelaxed.get(relaxed) || []), c])
  }
  clients.forEach(add)

  const match = (rawName: string | null): ImportClient | null => {
    if (!rawName) return null
    const { first, last } = splitCustomerName(rawName)
    const exact = byName.get(`${norm(first)} ${norm(last)}`.trim())
    if (exact) return exact
    if (!last) return bySingle.get(norm(first)) || null
    const relaxed = relaxedKey(first, last)
    const near = relaxed ? byRelaxed.get(relaxed) : undefined
    if (near && near.length === 1) return near[0]
    const candidates = byLast.get(norm(last))
    if (candidates && candidates.length === 1) return candidates[0]
    return null
  }

  return { match, add }
}

export function buildClientMatcher(clients: ImportClient[]) {
  return createClientIndex(clients).match
}

/**
 * The import result lists one unmatched entry per report LINE; collapse that to
 * one entry per customer (first-seen order) with how many lines they had. Blank
 * customers are dropped — there is no name to create a client from.
 */
export function distinctUnmatchedNames(unmatched: Array<{ customer: string }>): Array<{ name: string; lines: number }> {
  const seen = new Map<string, { name: string; lines: number }>()
  for (const u of unmatched) {
    const name = (u.customer || '').trim().replace(/\s+/g, ' ')
    if (!name || name === '(blank)') continue
    const key = name.toLowerCase()
    const entry = seen.get(key)
    if (entry) entry.lines++
    else seen.set(key, { name, lines: 1 })
  }
  return [...seen.values()]
}

export type PlannedClient = { name: string; first_name: string; last_name: string; company: string | null }

/**
 * Which of these QuickBooks names need a new CRM client. A name that already
 * matches a client (same matcher as the purchase import) is skipped, so running
 * this twice creates nothing the second time. Two spellings of one person in the
 * same request ("Andrew S Cohen", "Andrew Cohen") create a single client.
 */
export function planMissingClients(names: string[], clients: ImportClient[]): { create: PlannedClient[]; existing: string[] } {
  const index = createClientIndex(clients)
  const create: PlannedClient[] = []
  const existing: string[] = []
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name || name === '(blank)') continue
    if (index.match(name)) { existing.push(name); continue }
    const { first, last, company } = parseCustomerName(name)
    const planned: PlannedClient = { name, first_name: first || 'Unknown', last_name: last, company }
    create.push(planned)
    index.add({ id: `planned:${create.length}`, first_name: planned.first_name, last_name: planned.last_name })
  }
  return { create, existing }
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export function planPurchaseImport(
  rows: IncomingPurchaseRow[],
  clients: ImportClient[],
  existing: ExistingPurchaseRow[],
  today: Date = new Date(),
): ImportPlan {
  const matchClient = buildClientMatcher(clients)
  const deliveredCutoff = isoDaysAgo(today, ASSUME_DELIVERED_AFTER_DAYS)

  // Pool of existing rows, bucketed by where a line "lives" (client + invoice, or
  // client + date when the report has no invoice number) and what it is.
  const pool = new Map<string, ExistingPurchaseRow[]>()
  const bucketKey = (kind: string, clientId: string, invoiceId: string | null, date: string | null, product: string, description: string) =>
    `${kind}|${clientId}|${invoiceId ? `inv:${norm(invoiceId)}` : `date:${date || ''}`}|${norm(product)}|${norm(description)}`
  for (const e of existing) {
    const key = bucketKey(e.kind, e.client_id, e.invoice_id, e.date, e.product, e.description)
    pool.set(key, [...(pool.get(key) || []), e])
  }

  // Two lines on one invoice can share product + description but differ in price
  // (same shirt fabric, one discounted). Take the row that already agrees on
  // price/quantity first; otherwise rows would swap prices on every re-import.
  const take = (key: string, price: number | null, quantity?: number): ExistingPurchaseRow | undefined => {
    const bucket = pool.get(key)
    if (!bucket || bucket.length === 0) return undefined
    let idx = bucket.findIndex((e) => money(e.price) === money(price) && (quantity === undefined || (e.quantity || 1) === quantity))
    if (idx < 0) idx = bucket.findIndex((e) => money(e.price) === money(price))
    if (idx < 0) idx = 0
    return bucket.splice(idx, 1)[0]
  }

  const plan: ImportPlan = {
    inserts: [], updates: [], unchanged: 0, skipped: 0,
    serviceLines: 0, discountLines: 0, outOfScopeLines: 0, refundLines: 0,
    unmatched: [], needsReview: [], lastPurchaseByClient: new Map(),
  }

  rows.forEach((row, i) => {
    const rowNum = i + 1
    const customerName = clean(row.customer)
    const productName = clean(row.product) || ''
    const description = clean(row.description) || ''
    const txDate = parseDate(row.date)
    const rawQty = parseNumber(row.quantity)
    const qty = rawQty !== null && rawQty > 0 ? rawQty : 1
    const amount = parseNumber(row.amount)
    const invoiceId = clean(row.invoice_id)
    const lineId = clean(row.line_id)

    if (!productName) { plan.skipped++; return }

    const parsed = parseInvoiceLineItem(productName, description)
    if (parsed.category === 'service') { plan.serviceLines++; plan.skipped++; return }
    if (parsed.category === 'discount') { plan.discountLines++; plan.skipped++; return }
    if (parsed.category === 'skip') { plan.outOfScopeLines++; plan.skipped++; return }

    // Negative amount on a real purchase = refund line; skip.
    if ((parsed.category === 'ready_made' || parsed.category === 'custom') && amount !== null && amount < 0) {
      plan.refundLines++; plan.skipped++; return
    }

    const client = matchClient(customerName)
    if (!client) {
      plan.unmatched.push({ row: rowNum, customer: customerName || '(blank)' })
      plan.skipped++
      return
    }

    if (parsed.category === 'unknown') {
      plan.needsReview.push({ row: rowNum, customer: customerName || '', product: productName, description })
      plan.skipped++
      return
    }

    const each = unitPrice(amount, qty)

    if (parsed.category === 'custom') {
      // Each garment is its own order (it moves through production on its own),
      // so "Custom Shirt, qty 2, $498" becomes two shirts at $249.
      const garments = Number.isInteger(qty) && qty <= MAX_GARMENTS_PER_LINE ? qty : 1
      const price = garments === qty ? each : amount
      const garmentType = GARMENT_DB_MAP[parsed.garment_type || 'other']
      const key = bucketKey('custom', client.id, invoiceId, txDate, garmentType, description)
      for (let n = 0; n < garments; n++) {
        const match = take(key, price)
        if (match) {
          if (money(match.price) !== money(price) && price !== null) {
            plan.updates.push({ kind: 'custom', id: match.id, patch: { price } })
          } else {
            plan.unchanged++
          }
          continue
        }
        const orderDate = txDate || today.toISOString().split('T')[0]
        plan.inserts.push({
          kind: 'custom',
          row: rowNum,
          payload: {
            client_id: client.id,
            garment_type: garmentType,
            fabric_name: description || null,
            price,
            order_date: orderDate,
            status: orderDate < deliveredCutoff ? 'delivered' : 'ordered',
            quickbooks_invoice_id: invoiceId,
          },
        })
      }
    } else {
      const key = bucketKey('ready_made', client.id, invoiceId, txDate, productName, description)
      const match = take(key, each, qty)
      if (match) {
        const patch: Record<string, number> = {}
        if (each !== null && money(match.price) !== money(each)) patch.price = each
        if ((match.quantity || 1) !== qty) patch.quantity = qty
        if (Object.keys(patch).length) plan.updates.push({ kind: 'ready_made', id: match.id, patch })
        else plan.unchanged++
      } else {
        const brand = parsed.brand || null
        plan.inserts.push({
          kind: 'ready_made',
          row: rowNum,
          payload: {
            client_id: client.id,
            category: brand && READY_MADE_CATEGORY[brand] ? READY_MADE_CATEGORY[brand] : 'other',
            brand,
            product_name: productName,
            description: description || null,
            size: parsed.size || null,
            price: each,
            quantity: qty,
            purchase_date: txDate,
            quickbooks_invoice_id: invoiceId,
            quickbooks_line_id: lineId ? `${invoiceId || ''}-${lineId}` : null,
          },
        })
      }
    }

    if (txDate) {
      const prev = plan.lastPurchaseByClient.get(client.id)
      if (!prev || txDate > prev) plan.lastPurchaseByClient.set(client.id, txDate)
    }
  })

  return plan
}
