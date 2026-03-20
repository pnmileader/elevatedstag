import { NextResponse } from 'next/server'
import { checkAndQueueReactivationEmails } from '@/lib/emailAutomation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await checkAndQueueReactivationEmails()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking reactivation:', error)
    return NextResponse.json({ error: 'Failed to check reactivation' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
