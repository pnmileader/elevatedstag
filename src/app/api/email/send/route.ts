import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    clientId?: string
    to?: string | string[]
    subject?: string
    emailBody?: string
    templateId?: string
    replyTo?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clientId, to, subject, emailBody, templateId, replyTo } = body

  if (!to || !subject || !emailBody) {
    return NextResponse.json(
      { error: 'to, subject, and emailBody are required' },
      { status: 400 },
    )
  }

  const result = await sendEmail({
    to,
    subject,
    html: emailBody,
    replyTo,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const now = new Date().toISOString()
  const toEmail = Array.isArray(to) ? to[0] : to

  await supabase.from('sent_emails').insert({
    client_id: clientId || null,
    to_email: toEmail,
    subject,
    body: emailBody,
    template_id: templateId || null,
    status: 'sent',
    sent_at: now,
  })

  if (clientId) {
    await supabase
      .from('clients')
      .update({ last_contact_date: now })
      .eq('id', clientId)

    await supabase.from('activity_log').insert({
      client_id: clientId,
      activity_type: 'email_sent',
      title: 'Email sent',
      description: subject,
    })
  }

  return NextResponse.json({ success: true, messageId: result.id })
}
