import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson, ImportRowsSchema } from '@/lib/validation'
import {
  planPurchaseImport,
  type ExistingPurchaseRow,
  type ImportClient,
  type IncomingPurchaseRow,
} from '@/lib/purchaseImport'

// Big imports (full QuickBooks history) need more than the default 10s.
export const maxDuration = 60

const PAGE = 1000 // PostgREST caps a response at 1000 rows — page through everything
const INSERT_CHUNK = 200

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + PAGE - 1)
    if (error) return { data: out, error: error.message }
    out.push(...((data || []) as T[]))
    if (!data || data.length < PAGE) return { data: out, error: null }
  }
}

type CustomRow = { id: string; client_id: string; quickbooks_invoice_id: string | null; order_date: string | null; garment_type: string | null; fabric_name: string | null; price: number | null }
type ReadyRow = { id: string; client_id: string; quickbooks_invoice_id: string | null; purchase_date: string | null; product_name: string | null; description: string | null; price: number | null; quantity: number | null }
type ClientDates = ImportClient & { last_purchase_date: string | null; last_contact_date: string | null }

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJson(req, ImportRowsSchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: parsed.status })
  }
  const rows = parsed.data.rows as unknown as IncomingPurchaseRow[]
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const [clientsRes, customRes, readyRes] = await Promise.all([
    fetchAll<ClientDates>(supabase, 'clients', 'id, first_name, last_name, last_purchase_date, last_contact_date'),
    fetchAll<CustomRow>(supabase, 'custom_orders', 'id, client_id, quickbooks_invoice_id, order_date, garment_type, fabric_name, price'),
    fetchAll<ReadyRow>(supabase, 'ready_made_purchases', 'id, client_id, quickbooks_invoice_id, purchase_date, product_name, description, price, quantity'),
  ])
  const loadError = clientsRes.error || customRes.error || readyRes.error
  if (loadError) {
    return NextResponse.json({ error: `Failed to load existing data: ${loadError}` }, { status: 500 })
  }

  const existing: ExistingPurchaseRow[] = [
    ...customRes.data.map((o) => ({
      id: o.id, kind: 'custom' as const, client_id: o.client_id, invoice_id: o.quickbooks_invoice_id,
      date: o.order_date, product: o.garment_type || '', description: o.fabric_name || '', price: o.price, quantity: null,
    })),
    ...readyRes.data.map((p) => ({
      id: p.id, kind: 'ready_made' as const, client_id: p.client_id, invoice_id: p.quickbooks_invoice_id,
      date: p.purchase_date, product: p.product_name || '', description: p.description || '', price: p.price, quantity: p.quantity,
    })),
  ]

  const plan = planPurchaseImport(rows, clientsRes.data, existing)

  const errors: Array<{ row: number; error: string }> = []
  let customCreated = 0
  let readyMadeCreated = 0
  let updated = 0

  for (const kind of ['custom', 'ready_made'] as const) {
    const table = kind === 'custom' ? 'custom_orders' : 'ready_made_purchases'
    const inserts = plan.inserts.filter((i) => i.kind === kind)
    for (let at = 0; at < inserts.length; at += INSERT_CHUNK) {
      const chunk = inserts.slice(at, at + INSERT_CHUNK)
      const { error } = await supabase.from(table).insert(chunk.map((c) => c.payload))
      if (!error) {
        if (kind === 'custom') customCreated += chunk.length
        else readyMadeCreated += chunk.length
        continue
      }
      // One bad row fails the whole batch — retry singly so the rest still land
      // and the bad row is reported by its line number.
      for (const item of chunk) {
        const { error: rowError } = await supabase.from(table).insert(item.payload)
        if (rowError) errors.push({ row: item.row, error: rowError.message })
        else if (kind === 'custom') customCreated++
        else readyMadeCreated++
      }
    }
  }

  for (const u of plan.updates) {
    const table = u.kind === 'custom' ? 'custom_orders' : 'ready_made_purchases'
    const { error } = await supabase.from(table).update(u.patch).eq('id', u.id)
    if (error) errors.push({ row: 0, error: `update ${u.id}: ${error.message}` })
    else updated++
  }

  // Dates only ever move forward: a re-import of old history must not pull a
  // client's last-contact date back behind an email Katie sent last week.
  const datesById = new Map(clientsRes.data.map((c) => [c.id, c]))
  for (const [clientId, date] of plan.lastPurchaseByClient.entries()) {
    const current = datesById.get(clientId)
    const patch: Record<string, string> = {}
    if (!current?.last_purchase_date || current.last_purchase_date.slice(0, 10) < date) patch.last_purchase_date = date
    if (!current?.last_contact_date || current.last_contact_date.slice(0, 10) < date) patch.last_contact_date = date
    if (Object.keys(patch).length) await supabase.from('clients').update(patch).eq('id', clientId)
  }

  return NextResponse.json({
    success: true,
    customCreated,
    readyMadeCreated,
    updated,
    unchanged: plan.unchanged,
    deduped: plan.unchanged, // older UI name for "already in the CRM"
    skipped: plan.skipped + errors.length,
    serviceLines: plan.serviceLines,
    discountLines: plan.discountLines,
    outOfScopeLines: plan.outOfScopeLines,
    refundLines: plan.refundLines,
    insertErrors: errors.length,
    total: rows.length,
    unmatched: plan.unmatched,
    needsReview: plan.needsReview,
    errors: errors.slice(0, 50),
    errorsTruncated: errors.length > 50 ? errors.length - 50 : 0,
  })
}
