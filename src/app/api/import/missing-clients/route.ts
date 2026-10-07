// Creates name-only clients for QuickBooks customers the purchase-history import
// could not match, so Katie can re-run the import instead of typing them in.
//
// Idempotent: every name goes through the same matcher the purchase import uses
// (planMissingClients), so a name that already matches a client — or one created
// earlier in this request — is skipped. Running it twice creates nothing new.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson, CreateMissingClientsSchema } from '@/lib/validation'
import { createMissingClients } from '@/lib/importRunners'

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

  const result = await createMissingClients(supabase, parsed.data.names)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
