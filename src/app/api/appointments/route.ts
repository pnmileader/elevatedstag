import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateAppointmentIcs } from '@/lib/calendar'
import { sendEmail } from '@/lib/email'

type CreateBody = {
  client_id?: string | null
  appointment_type?: string
  title?: string
  start_time?: string
  end_time?: string
  location?: string | null
  notes?: string | null
  status?: string
}

const TZ = 'America/Chicago'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso))
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso))
}

function buildInviteHtml(opts: {
  firstName: string
  appointmentType: string
  formattedDate: string
  formattedTime: string
  location: string | null
}): string {
  const locationFragment = opts.location ? ` at ${opts.location}` : ''
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #222;">
  <p style="font-size: 16px; margin: 0 0 16px;">Hi ${opts.firstName},</p>
  <p style="font-size: 16px; margin: 0 0 16px;">
    Confirming our <strong>${opts.appointmentType}</strong> on
    <strong>${opts.formattedDate}</strong> at <strong>${opts.formattedTime}</strong>${locationFragment}.
  </p>
  <p style="font-size: 16px; margin: 0 0 16px;">
    Tap the attached calendar invite to add this to your calendar.
  </p>
  <p style="font-size: 16px; margin: 24px 0 4px;">Looking forward to seeing you,</p>
  <p style="font-size: 16px; margin: 0; font-weight: 600;">Katie</p>
  <p style="font-size: 14px; color: #666; margin: 4px 0 0;">The Elevated Stag</p>
</div>`
}

function prettyType(type: string | undefined | null): string {
  if (!type) return 'Appointment'
  if (type.toLowerCase() === 'wardrobe') return 'Wardrobe Appointment'
  if (type.toLowerCase() === 'fitting') return 'Fitting'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, appointment_type, title, start_time, end_time, location, notes, status } = body

  if (!start_time || !end_time) {
    return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 })
  }

  const insertPayload: Record<string, unknown> = {
    client_id: client_id || null,
    appointment_type: appointment_type || null,
    title: title || null,
    start_time,
    end_time,
    location: location || null,
    notes: notes || null,
    status: status || 'scheduled',
  }

  const { data: appointment, error: insertErr } = await supabase
    .from('appointments')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertErr || !appointment) {
    console.error('[appointments] Insert failed:', insertErr)
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to create appointment' },
      { status: 500 },
    )
  }

  let client: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  } | null = null

  if (client_id) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone')
      .eq('id', client_id)
      .single()
    client = clientRow

    await supabase
      .from('clients')
      .update({ last_contact_date: new Date().toISOString().split('T')[0] })
      .eq('id', client_id)
  }

  let inviteSent = false
  let inviteError: string | null = null

  if (client && client.email) {
    const icsResult = generateAppointmentIcs(
      {
        id: appointment.id,
        appointment_type: appointment.appointment_type,
        title: appointment.title,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        location: appointment.location,
        notes: appointment.notes,
      },
      client,
    )

    if (!icsResult.success) {
      console.error('[appointments] ics generation failed:', icsResult.error)
      inviteError = `ics: ${icsResult.error}`
    } else {
      const formattedDate = formatDate(appointment.start_time)
      const formattedTime = formatTime(appointment.start_time)
      const html = buildInviteHtml({
        firstName: client.first_name || 'there',
        appointmentType: prettyType(appointment.appointment_type),
        formattedDate,
        formattedTime,
        location: appointment.location,
      })

      const sendResult = await sendEmail({
        to: client.email,
        subject: 'Your appointment with Katie at The Elevated Stag',
        html,
        attachments: [
          {
            filename: 'appointment.ics',
            content: icsResult.value,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      })

      if (sendResult.success) {
        inviteSent = true
        await supabase.from('activity_log').insert({
          client_id: client.id,
          activity_type: 'appointment_invite_sent',
          title: 'Calendar invite sent',
          description: `${prettyType(appointment.appointment_type)} on ${formattedDate} at ${formattedTime}`,
        })
      } else {
        inviteError = `email: ${sendResult.error}`
        console.error('[appointments] Invite send failed:', sendResult.error)
      }
    }
  }

  return NextResponse.json({
    success: true,
    appointment,
    inviteSent,
    inviteError,
  })
}
