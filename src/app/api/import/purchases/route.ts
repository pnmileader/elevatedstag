import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseInvoiceLineItem, type GarmentType } from '@/lib/quickbooks'

type IncomingRow = {
  customer?: string
  date?: string
  product?: string
  description?: string
  quantity?: string | number
  amount?: string | number
  invoice_id?: string
  line_id?: string
}

type ClientRow = { id: string; first_name: string | null; last_name: string | null }

const GARMENT_DB_MAP: Record<GarmentType, string> = {
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
  '34 Heritage': 'jeans',
  '7Diamonds': 'other',
  Accessory: 'accessories',
}

function clean(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function parseDate(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  // QBO format is MM/DD/YYYY — parse explicitly so it works regardless of locale.
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const mm = mdy[1].padStart(2, '0')
    const dd = mdy[2].padStart(2, '0')
    return `${mdy[3]}-${mm}-${dd}`
  }
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  const s = String(v).replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function splitCustomerName(name: string): { first: string; last: string } {
  const trimmed = name.trim()
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map((p) => p.trim())
    return { first: first || '', last: last || '' }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { rows?: IncomingRow[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const { data: allClients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, first_name, last_name')

  if (clientsErr) {
    return NextResponse.json({ error: `Failed to load clients: ${clientsErr.message}` }, { status: 500 })
  }

  const clientByName = new Map<string, ClientRow>()
  const clientByLast = new Map<string, ClientRow[]>()
  for (const c of (allClients as ClientRow[]) || []) {
    const first = (c.first_name || '').trim().toLowerCase()
    const last = (c.last_name || '').trim().toLowerCase()
    if (first && last) clientByName.set(`${first} ${last}`, c)
    if (last) {
      const arr = clientByLast.get(last) || []
      arr.push(c)
      clientByLast.set(last, arr)
    }
  }

  function matchClient(rawName: string | null): ClientRow | null {
    if (!rawName) return null
    const { first, last } = splitCustomerName(rawName)
    const key = `${first.toLowerCase()} ${last.toLowerCase()}`.trim()
    const exact = clientByName.get(key)
    if (exact) return exact
    if (last) {
      const candidates = clientByLast.get(last.toLowerCase())
      if (candidates && candidates.length === 1) return candidates[0]
    }
    return null
  }

  let customCreated = 0
  let readyMadeCreated = 0
  let skipped = 0
  let serviceLines = 0
  let discountLines = 0
  let outOfScopeLines = 0
  let refundLines = 0
  let insertErrors = 0
  let deduped = 0
  const unmatched: Array<{ row: number; customer: string }> = []
  const needsReview: Array<{ row: number; customer: string; product: string; description: string }> = []
  const errors: Array<{ row: number; error: string }> = []

  const seenLines = new Set<string>()
  const purchaseDateByClient = new Map<string, string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const customerName = clean(row.customer)
      const productName = clean(row.product) || ''
      const description = clean(row.description) || ''
      const txDate = parseDate(row.date)
      const qty = parseNumber(row.quantity) || 1
      const amount = parseNumber(row.amount)
      const invoiceId = clean(row.invoice_id)
      const lineId = clean(row.line_id)

      if (!productName) {
        skipped++
        continue
      }

      const parsed = parseInvoiceLineItem(productName, description)

      if (parsed.category === 'service') {
        serviceLines++
        skipped++
        continue
      }
      if (parsed.category === 'discount') {
        discountLines++
        skipped++
        continue
      }
      if (parsed.category === 'skip') {
        outOfScopeLines++
        skipped++
        continue
      }

      // Negative amount on a real purchase = refund line; skip.
      if ((parsed.category === 'ready_made' || parsed.category === 'custom') && amount !== null && amount < 0) {
        refundLines++
        skipped++
        continue
      }

      const client = matchClient(customerName)
      if (!client) {
        unmatched.push({ row: i + 1, customer: customerName || '(blank)' })
        skipped++
        continue
      }

      if (parsed.category === 'unknown') {
        needsReview.push({
          row: i + 1,
          customer: customerName || '',
          product: productName,
          description,
        })
        skipped++
        continue
      }

      const dedupeKey = `${client.id}|${invoiceId || ''}|${productName}|${lineId || ''}|${txDate || ''}`
      if (seenLines.has(dedupeKey)) {
        deduped++
        continue
      }
      seenLines.add(dedupeKey)

      if (invoiceId) {
        const table = parsed.category === 'custom' ? 'custom_orders' : 'ready_made_purchases'
        const dateCol = parsed.category === 'custom' ? 'order_date' : 'purchase_date'
        const productCol = parsed.category === 'custom' ? 'garment_type' : 'product_name'
        const productVal = parsed.category === 'custom'
          ? GARMENT_DB_MAP[parsed.garment_type || 'other']
          : productName

        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .eq('client_id', client.id)
          .eq('quickbooks_invoice_id', invoiceId)
          .eq(productCol, productVal)
          .eq(dateCol, txDate)
          .limit(1)
          .maybeSingle()

        if (existing) {
          deduped++
          continue
        }
      }

      if (parsed.category === 'custom') {
        const garmentType = GARMENT_DB_MAP[parsed.garment_type || 'other']
        const { error: insertErr } = await supabase
          .from('custom_orders')
          .insert({
            client_id: client.id,
            garment_type: garmentType,
            fabric_name: description || null,
            price: amount,
            order_date: txDate || new Date().toISOString().split('T')[0],
            status: 'ordered',
            quickbooks_invoice_id: invoiceId,
          })
        if (insertErr) {
          errors.push({ row: i + 1, error: insertErr.message })
          insertErrors++
          skipped++
          continue
        }
        customCreated++
      } else {
        const brand = parsed.brand || null
        const category = brand && READY_MADE_CATEGORY[brand] ? READY_MADE_CATEGORY[brand] : 'other'
        const { error: insertErr } = await supabase
          .from('ready_made_purchases')
          .insert({
            client_id: client.id,
            category,
            brand,
            product_name: productName,
            description: description || null,
            size: parsed.size || null,
            price: amount,
            quantity: qty,
            purchase_date: txDate,
            quickbooks_invoice_id: invoiceId,
            quickbooks_line_id: lineId ? `${invoiceId || ''}-${lineId}` : null,
          })
        if (insertErr) {
          errors.push({ row: i + 1, error: insertErr.message })
          insertErrors++
          skipped++
          continue
        }
        readyMadeCreated++
      }

      if (txDate) {
        const prev = purchaseDateByClient.get(client.id)
        if (!prev || txDate > prev) purchaseDateByClient.set(client.id, txDate)
      }
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'unknown error' })
      insertErrors++
      skipped++
    }
  }

  for (const [clientId, date] of purchaseDateByClient.entries()) {
    await supabase
      .from('clients')
      .update({ last_purchase_date: date, last_contact_date: date })
      .eq('id', clientId)
  }

  return NextResponse.json({
    success: true,
    customCreated,
    readyMadeCreated,
    skipped,
    deduped,
    serviceLines,
    discountLines,
    outOfScopeLines,
    refundLines,
    insertErrors,
    total: rows.length,
    unmatched,
    needsReview,
    errors: errors.slice(0, 50),
    errorsTruncated: errors.length > 50 ? errors.length - 50 : 0,
  })
}
