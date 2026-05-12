import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateAppointmentIcs } from '@/lib/calendar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('id, appointment_type, title, start_time, end_time, location, notes, client_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[ics] Failed to load appointment:', error)
    return NextResponse.json({ error: 'Failed to load appointment' }, { status: 500 })
  }

  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  let client = {
    id: '',
    first_name: 'Client' as string | null,
    last_name: '' as string | null,
    email: null as string | null,
    phone: null as string | null,
  }

  if (appointment.client_id) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone')
      .eq('id', appointment.client_id)
      .maybeSingle()
    if (clientRow) client = clientRow
  }

  const result = generateAppointmentIcs(appointment, client)
  if (!result.success) {
    console.error('[ics] generation failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return new NextResponse(result.value, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="appointment-${id}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
