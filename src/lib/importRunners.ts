// The QuickBooks import steps that write to the database, shared by the Settings → Import
// routes (Katie, signed in) and the Zapier webhook (no session, service-role client).
// Matching and de-duplication live in purchaseImport.ts; this file only loads what is
// already there and executes the plan.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  planMissingClients,
  planPurchaseImport,
  type ExistingPurchaseRow,
  type ImportClient,
  type IncomingPurchaseRow,
  type MatchOptions,
} from '@/lib/purchaseImport'

const PAGE = 1000 // PostgREST caps a response at 1000 rows — page through everything
const INSERT_CHUNK = 200

export async function fetchAll<T>(
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

const todayISO = () => new Date().toISOString().split('T')[0]

// ─── Clients ────────────────────────────────────────────────────────────────

export type IncomingClientRow = {
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  customer_type?: string
  billing_street?: string
  billing_city?: string
  billing_state?: string
  billing_zip?: string
  shipping_street?: string
  shipping_city?: string
  shipping_state?: string
  shipping_zip?: string
  notes?: string
}

type ExistingClient = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  billing_address: Record<string, unknown> | null
  shipping_address: Record<string, unknown> | null
  location_tags: string[] | null
}

export type ClientImportResult = {
  success: true
  imported: number
  updated: number
  skipped: number
  total: number
  errors: Array<{ row: number; error: string }>
}

function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map((p) => p.trim())
    return { first: first || '', last: last || '' }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((x) => x && x.trim())))
}

function blank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

function clean(v: unknown): string | null {
  if (blank(v)) return null
  return String(v).trim()
}

function normalizeEmail(v: unknown): string | null {
  const cleaned = clean(v)
  return cleaned ? cleaned.toLowerCase() : null
}

function normalizePhone(v: unknown): string | null {
  const cleaned = clean(v)
  if (!cleaned) return null
  return cleaned.replace(/\D/g, '') || null
}

function buildAddress(street?: string, city?: string, state?: string, zip?: string) {
  const s = clean(street)
  const c = clean(city)
  const st = clean(state)
  const z = clean(zip)
  if (!s && !c && !st && !z) return null
  return { street: s, city: c, state: st, zip: z }
}

/**
 * Create new clients and fill in blanks on existing ones. Matches email → phone → first+last
 * name. Never overwrites a value Katie already has, so re-running is safe.
 */
export async function runClientImport(
  supabase: SupabaseClient,
  rows: IncomingClientRow[],
  source = 'quickbooks_import',
): Promise<ClientImportResult | { error: string }> {
  const { data: allExisting, error: fetchErr } = await fetchAll<ExistingClient>(
    supabase,
    'clients',
    'id, first_name, last_name, email, phone, notes, billing_address, shipping_address, location_tags',
  )
  if (fetchErr) return { error: `Failed to load clients: ${fetchErr}` }

  // For email matching: a single email can map to MULTIPLE clients (rare but seen in real data).
  // We store an array per key so we can disambiguate by last name later.
  const byEmail = new Map<string, ExistingClient[]>()
  const byPhone = new Map<string, ExistingClient>()
  const byName = new Map<string, ExistingClient>()
  const remember = (c: ExistingClient) => {
    if (c.email) {
      const key = c.email.toLowerCase()
      byEmail.set(key, [...(byEmail.get(key) || []), c])
    }
    if (c.phone) {
      const digits = c.phone.replace(/\D/g, '')
      if (digits) byPhone.set(digits, c)
    }
    if (c.first_name && c.last_name) {
      byName.set(`${c.first_name.trim().toLowerCase()}|${c.last_name.trim().toLowerCase()}`, c)
    }
  }
  allExisting.forEach(remember)

  let imported = 0
  let updated = 0
  let skipped = 0
  const errors: Array<{ row: number; error: string }> = []
  const today = todayISO()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      // If full_name is provided (Excel "Name" column), split it. Explicit first_name/last_name win.
      let first = clean(row.first_name)
      let last = clean(row.last_name)
      if ((!first || !last) && !blank(row.full_name)) {
        const split = splitFullName(String(row.full_name).trim())
        if (!first) first = split.first || null
        if (!last) last = split.last || null
      }

      const email = normalizeEmail(row.email)
      const phone = normalizePhone(row.phone)
      const customerType = clean(row.customer_type)

      if (!first && !last && !email && !phone) {
        skipped++
        continue
      }

      // Match: email → phone → first+last name.
      let match: ExistingClient | undefined
      if (email) {
        const candidates = byEmail.get(email) || []
        if (candidates.length === 1) {
          match = candidates[0]
        } else if (candidates.length > 1) {
          // Duplicate emails — disambiguate by last name. Log a warning either way.
          console.warn(`[import] ${candidates.length} clients share an email; disambiguating by last name`)
          if (last) {
            match = candidates.find((c) => (c.last_name || '').toLowerCase().trim() === last!.toLowerCase().trim())
          }
          if (!match) match = candidates[0] // fall back to first match
        }
      }
      if (!match && phone) match = byPhone.get(phone)
      if (!match && first && last) match = byName.get(`${first.toLowerCase()}|${last.toLowerCase()}`)

      const billing_address = buildAddress(row.billing_street, row.billing_city, row.billing_state, row.billing_zip)
      const shipping_address = buildAddress(row.shipping_street, row.shipping_city, row.shipping_state, row.shipping_zip)

      const notesParts: string[] = []
      if (!blank(row.company)) notesParts.push(`Company: ${clean(row.company)}`)
      if (!blank(row.notes)) notesParts.push(String(row.notes).trim())
      const incomingNotes = notesParts.length ? notesParts.join('\n') : null

      if (match) {
        const updateData: Record<string, unknown> = {}
        if (!match.first_name && first) updateData.first_name = first
        if (!match.last_name && last) updateData.last_name = last
        if (!match.email && email) updateData.email = email
        if (!match.phone && phone) updateData.phone = phone
        if (!match.billing_address && billing_address) updateData.billing_address = billing_address
        if (!match.shipping_address && shipping_address) updateData.shipping_address = shipping_address
        if (incomingNotes && !match.notes) updateData.notes = incomingNotes
        else if (incomingNotes && match.notes && !match.notes.includes(incomingNotes)) {
          updateData.notes = `${match.notes}\n${incomingNotes}`
        }

        // Merge customer_type into location_tags without duplicating.
        if (customerType) {
          const existingTags = Array.isArray(match.location_tags) ? match.location_tags : []
          if (!existingTags.includes(customerType)) {
            updateData.location_tags = uniq([...existingTags, customerType])
          }
        }

        if (Object.keys(updateData).length === 0) {
          skipped++
          continue
        }

        updateData.updated_at = new Date().toISOString()

        const { error: updateErr } = await supabase.from('clients').update(updateData).eq('id', match.id)
        if (updateErr) {
          errors.push({ row: i + 1, error: updateErr.message })
          skipped++
        } else {
          Object.assign(match, updateData)
          remember(match)
          updated++
        }
        continue
      }

      const insertPayload: Record<string, unknown> = {
        first_name: first || 'Unknown',
        last_name: last || '',
        email,
        phone,
        billing_address,
        shipping_address,
        notes: incomingNotes,
        stage: 'active',
        source,
        first_contact_date: today,
        // last_contact_date intentionally left null — populated by the purchases
        // import or by real activity (sent emails, appointments, etc.).
      }
      if (customerType) {
        insertPayload.location_tags = [customerType]
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('clients')
        .insert(insertPayload)
        .select('id, first_name, last_name, email, phone, notes, billing_address, shipping_address, location_tags')
        .single()

      if (insertErr || !inserted) {
        errors.push({ row: i + 1, error: insertErr?.message || 'insert failed' })
        skipped++
        continue
      }

      remember(inserted as ExistingClient)
      imported++
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'unknown error' })
      skipped++
    }
  }

  return { success: true, imported, updated, skipped, total: rows.length, errors: errors.slice(0, 50) }
}

// ─── Missing clients (names from the sales report with no CRM match) ──────────

export type MissingClientsResult = {
  success: true
  created: number
  alreadyMatched: number
  errors: Array<{ name: string; error: string }>
}

/** Name-only clients for QuickBooks customers nobody matched. Idempotent (same matcher as the purchase import). */
export async function createMissingClients(
  supabase: SupabaseClient,
  names: string[],
  source = 'quickbooks_import',
  options?: MatchOptions,
): Promise<MissingClientsResult | { error: string }> {
  const { data: clients, error: loadError } = await fetchAll<ImportClient>(supabase, 'clients', 'id, first_name, last_name')
  if (loadError) return { error: `Failed to load clients: ${loadError}` }

  const plan = planMissingClients(names, clients, options)
  const today = todayISO()
  // Same stage / first-contact the client importer gives a new client.
  const payloads = plan.create.map((c) => ({
    first_name: c.first_name,
    last_name: c.last_name,
    notes: c.company ? `Company: ${c.company}` : null,
    stage: 'active',
    source,
    first_contact_date: today,
  }))

  let created = 0
  const errors: Array<{ name: string; error: string }> = []
  for (let at = 0; at < payloads.length; at += INSERT_CHUNK) {
    const chunk = payloads.slice(at, at + INSERT_CHUNK)
    const { error } = await supabase.from('clients').insert(chunk)
    if (!error) {
      created += chunk.length
      continue
    }
    // One bad row fails the whole batch — retry singly so the rest still land.
    for (let i = 0; i < chunk.length; i++) {
      const { error: rowError } = await supabase.from('clients').insert(chunk[i])
      if (rowError) errors.push({ name: plan.create[at + i].name, error: rowError.message })
      else created++
    }
  }

  return { success: true, created, alreadyMatched: plan.existing.length, errors: errors.slice(0, 50) }
}

// ─── Purchases ──────────────────────────────────────────────────────────────

type CustomRow = { id: string; client_id: string; quickbooks_invoice_id: string | null; order_date: string | null; garment_type: string | null; fabric_name: string | null; price: number | null }
type ReadyRow = { id: string; client_id: string; quickbooks_invoice_id: string | null; purchase_date: string | null; product_name: string | null; description: string | null; price: number | null; quantity: number | null }
type ClientDates = ImportClient & { last_purchase_date: string | null; last_contact_date: string | null }

export type PurchaseImportResult = {
  success: true
  customCreated: number
  readyMadeCreated: number
  updated: number
  unchanged: number
  deduped: number
  skipped: number
  serviceLines: number
  discountLines: number
  outOfScopeLines: number
  refundLines: number
  insertErrors: number
  total: number
  unmatched: Array<{ row: number; customer: string }>
  needsReview: Array<{ row: number; customer: string; product: string; description: string }>
  errors: Array<{ row: number; error: string }>
  errorsTruncated: number
}

/** Insert new purchase lines and repair old ones in place (see planPurchaseImport). */
export async function runPurchaseImport(
  supabase: SupabaseClient,
  rows: IncomingPurchaseRow[],
  options?: MatchOptions,
): Promise<PurchaseImportResult | { error: string }> {
  const [clientsRes, customRes, readyRes] = await Promise.all([
    fetchAll<ClientDates>(supabase, 'clients', 'id, first_name, last_name, last_purchase_date, last_contact_date'),
    fetchAll<CustomRow>(supabase, 'custom_orders', 'id, client_id, quickbooks_invoice_id, order_date, garment_type, fabric_name, price'),
    fetchAll<ReadyRow>(supabase, 'ready_made_purchases', 'id, client_id, quickbooks_invoice_id, purchase_date, product_name, description, price, quantity'),
  ])
  const loadError = clientsRes.error || customRes.error || readyRes.error
  if (loadError) return { error: `Failed to load existing data: ${loadError}` }

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

  const plan = planPurchaseImport(rows, clientsRes.data, existing, new Date(), options)

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

  return {
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
  }
}
