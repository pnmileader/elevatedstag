import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The CRM has a single (live) Supabase project, so e2e tests run against real
// data. Everything the suite writes hangs off one throwaway client whose name
// starts with this marker, and is removed again in cleanup().
export const E2E_LAST_NAME = 'Zz-E2E-Playwright'
export const E2E_SINK_EMAIL = 'delivered@resend.dev' // Resend's always-accept test inbox

export async function signedInDb(): Promise<SupabaseClient> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await db.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password: process.env.E2E_PASSWORD!,
  })
  if (error) throw new Error(`e2e fixture sign-in failed: ${error.message}`)
  return db
}

export async function ensureTestClient(db: SupabaseClient, firstName = 'Testy'): Promise<string> {
  const { data: existing } = await db
    .from('clients')
    .select('id')
    .eq('last_name', E2E_LAST_NAME)
    .eq('first_name', firstName)
    .limit(1)
  if (existing?.[0]) return existing[0].id
  const { data, error } = await db
    .from('clients')
    .insert({
      first_name: firstName,
      last_name: E2E_LAST_NAME,
      email: E2E_SINK_EMAIL,
      stage: 'lead',
      source: 'e2e_test',
      billing_address: { city: 'E2E Testville', zip: '00001' },
      location_tags: ['E2E'],
    })
    .select('id')
    .single()
  if (error) throw new Error(`could not create e2e client: ${error.message}`)
  return data.id
}

export async function cleanup(db: SupabaseClient) {
  const { data: rows } = await db
    .from('clients')
    .select('id')
    .or(`last_name.eq.${E2E_LAST_NAME},last_name.eq.Playwright`)
  const ids = (rows || []).map((r) => r.id)
  if (ids.length) {
    for (const table of ['measurements', 'client_care_items', 'activity_log', 'sent_emails', 'custom_orders', 'ready_made_purchases', 'appointments']) {
      await db.from(table).delete().in('client_id', ids)
    }
    await db.from('clients').delete().in('id', ids)
  }
  await db.from('sent_emails').delete().eq('to_email', E2E_SINK_EMAIL)
  await db.from('email_templates').delete().like('name', 'E2E %')
}
