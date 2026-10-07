import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson, ImportRowsSchema } from '@/lib/validation'
import { runPurchaseImport } from '@/lib/importRunners'
import type { IncomingPurchaseRow } from '@/lib/purchaseImport'

// Big imports (full QuickBooks history) need more than the default 10s.
export const maxDuration = 60

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

  const result = await runPurchaseImport(supabase, rows)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
