import type { SupabaseClient } from '@supabase/supabase-js'
import { clientDisplayName } from './clientDisplay'

export type ReferralClient = { id: string; first_name: string | null; last_name: string | null; stage?: string | null; last_purchase_date?: string | null }

// `clients.referred_by_id` arrives with supabase/migrations/20260920_add_referred_by_id.sql.
// Until that has been run we link referrals by the referrer's name, so probe once per page load.
let columnProbe: Promise<boolean> | null = null
export function hasReferredByIdColumn(supabase: SupabaseClient): Promise<boolean> {
  if (!columnProbe) {
    columnProbe = Promise.resolve(supabase.from('clients').select('referred_by_id').limit(1)).then(({ error }) => !error)
  }
  return columnProbe
}

/** Everyone this client has referred. */
export async function fetchReferrals(supabase: SupabaseClient, clientId: string, fullName: string): Promise<ReferralClient[]> {
  const cols = 'id, first_name, last_name, stage, last_purchase_date'
  const byName = fullName && fullName !== '(unnamed client)'
    ? await supabase.from('clients').select(cols).ilike('referred_by', fullName).neq('id', clientId)
    : { data: [] as ReferralClient[] }
  const found = new Map<string, ReferralClient>((byName.data || []).map((c) => [c.id, c]))
  if (await hasReferredByIdColumn(supabase)) {
    const byId = await supabase.from('clients').select(cols).eq('referred_by_id', clientId)
    for (const c of byId.data || []) found.set(c.id, c)
  }
  return [...found.values()].sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)))
}

/** The client record behind a "Referred by" value, if there is exactly one. */
export async function resolveReferrer(
  supabase: SupabaseClient,
  client: { id: string; referred_by: string | null; referred_by_id?: string | null },
): Promise<ReferralClient | null> {
  if (client.referred_by_id) {
    const { data } = await supabase.from('clients').select('id, first_name, last_name').eq('id', client.referred_by_id).maybeSingle()
    if (data) return data
  }
  const name = (client.referred_by || '').trim()
  if (!name) return null
  const [first, ...rest] = name.split(/\s+/)
  let query = supabase.from('clients').select('id, first_name, last_name').ilike('first_name', first).neq('id', client.id)
  if (rest.length) query = query.ilike('last_name', rest.join(' '))
  const { data } = await query.limit(2)
  return data && data.length === 1 ? data[0] : null
}
