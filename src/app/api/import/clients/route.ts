import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type IncomingRow = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
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

  const { data: allExisting, error: fetchErr } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email, phone, notes, billing_address, shipping_address')

  if (fetchErr) {
    return NextResponse.json({ error: `Failed to load clients: ${fetchErr.message}` }, { status: 500 })
  }

  const byEmail = new Map<string, ExistingClient>()
  const byPhone = new Map<string, ExistingClient>()
  const byName = new Map<string, ExistingClient>()
  for (const c of (allExisting as ExistingClient[]) || []) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c)
    if (c.phone) {
      const digits = c.phone.replace(/\D/g, '')
      if (digits) byPhone.set(digits, c)
    }
    if (c.first_name && c.last_name) {
      byName.set(`${c.first_name.trim().toLowerCase()}|${c.last_name.trim().toLowerCase()}`, c)
    }
  }

  let imported = 0
  let updated = 0
  let skipped = 0
  const errors: Array<{ row: number; error: string }> = []

  const today = new Date().toISOString().split('T')[0]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const first = clean(row.first_name)
      const last = clean(row.last_name)
      const email = normalizeEmail(row.email)
      const phone = normalizePhone(row.phone)

      if (!first && !last && !email && !phone) {
        skipped++
        continue
      }

      let match: ExistingClient | undefined
      if (email) match = byEmail.get(email)
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

        if (Object.keys(updateData).length === 0) {
          skipped++
          continue
        }

        updateData.last_contact_date = today
        updateData.updated_at = new Date().toISOString()

        const { error: updateErr } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', match.id)

        if (updateErr) {
          errors.push({ row: i + 1, error: updateErr.message })
          skipped++
        } else {
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
        source: 'quickbooks_import',
        first_contact_date: today,
        last_contact_date: today,
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('clients')
        .insert(insertPayload)
        .select('id, first_name, last_name, email, phone, notes, billing_address, shipping_address')
        .single()

      if (insertErr || !inserted) {
        errors.push({ row: i + 1, error: insertErr?.message || 'insert failed' })
        skipped++
        continue
      }

      const ins = inserted as ExistingClient
      if (ins.email) byEmail.set(ins.email.toLowerCase(), ins)
      if (ins.phone) {
        const digits = ins.phone.replace(/\D/g, '')
        if (digits) byPhone.set(digits, ins)
      }
      if (ins.first_name && ins.last_name) {
        byName.set(`${ins.first_name.toLowerCase()}|${ins.last_name.toLowerCase()}`, ins)
      }

      imported++
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'unknown error' })
      skipped++
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    updated,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 50),
  })
}
