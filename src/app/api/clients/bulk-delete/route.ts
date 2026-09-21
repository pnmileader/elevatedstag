import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson } from '@/lib/validation'

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
})

// Child tables that point at a client. Deleted first so the client delete
// succeeds whether or not the foreign keys were created with ON DELETE CASCADE.
const CHILD_TABLES = [
  'measurements',
  'client_care_items',
  'custom_orders',
  'ready_made_purchases',
  'appointments',
  'email_queue',
  'activity_log',
  'sent_emails',
] as const

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJson(request, BulkDeleteSchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: parsed.status })
  }
  const { ids } = parsed.data

  // The child tables don't depend on each other, so clear them side by side.
  await Promise.all(
    CHILD_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).delete().in('client_id', ids)
      // A table without a client_id column / without delete rights shouldn't block the rest.
      if (error) console.warn(`[bulk-delete] ${table}: ${error.message}`)
    }),
  )

  const { data, error } = await supabase.from('clients').delete().in('id', ids).select('id')
  if (error) {
    return NextResponse.json({ error: `Could not delete clients: ${error.message}` }, { status: 500 })
  }

  console.log(`[bulk-delete] removed ${data?.length ?? 0} of ${ids.length} clients`)
  return NextResponse.json({ success: true, deleted: data?.length ?? 0, requested: ids.length })
}
