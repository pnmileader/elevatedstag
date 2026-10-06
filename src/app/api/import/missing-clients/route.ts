// Creates name-only clients for QuickBooks customers the purchase-history import
// could not match, so Katie can re-run the import instead of typing them in.
//
// Idempotent: every name goes through the same matcher the purchase import uses
// (planMissingClients), so a name that already matches a client — or one created
// earlier in this request — is skipped. Running it twice creates nothing new.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson, CreateMissingClientsSchema } from '@/lib/validation'
import { planMissingClients, type ImportClient } from '@/lib/purchaseImport'

const PAGE = 1000 // PostgREST caps a response at 1000 rows — page through every client
const INSERT_CHUNK = 200

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJson(req, CreateMissingClientsSchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: parsed.status })
  }

  const clients: ImportClient[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('clients').select('id, first_name, last_name').order('id').range(from, from + PAGE - 1)
    if (error) {
      return NextResponse.json({ error: `Failed to load clients: ${error.message}` }, { status: 500 })
    }
    clients.push(...((data || []) as ImportClient[]))
    if (!data || data.length < PAGE) break
  }

  const plan = planMissingClients(parsed.data.names, clients)
  const today = new Date().toISOString().split('T')[0]
  // Same stage / source / first-contact the client importer gives a new client.
  const payloads = plan.create.map((c) => ({
    first_name: c.first_name,
    last_name: c.last_name,
    notes: c.company ? `Company: ${c.company}` : null,
    stage: 'active',
    source: 'quickbooks_import',
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

  return NextResponse.json({
    success: true,
    created,
    alreadyMatched: plan.existing.length,
    errors: errors.slice(0, 50),
  })
}
