import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseJson, SendEmailSchema } from '@/lib/validation'
import { rateLimit, ipKey } from '@/lib/rateLimit'
import { renderEmail } from '@/lib/emailRender'

export async function POST(request: NextRequest) {
  // Defense in depth: even an authenticated user shouldn't burst-send.
  const limit = rateLimit(ipKey(request, 'email-send'), {
    windowMs: 60 * 60 * 1000,
    max: 300, // group emails to a tag/city/zip send one request per recipient
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Hourly sending limit reached (300). The remaining recipients were not emailed — try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseJson(request, SendEmailSchema)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: parsed.status })
  }

  const { clientId, to, subject, emailBody, templateId, replyTo } = parsed.data

  // Personalize here, not in the browser: the UI only swapped {FIRST_NAME}
  // when a client AND a template were picked in a particular order, so raw
  // placeholders (and literal "\n") reached real inboxes.
  let recipient: { first_name: string | null; last_name: string | null } | null = null
  if (clientId) {
    const { data } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('id', clientId)
      .maybeSingle()
    recipient = data
  }
  const rendered = renderEmail({ subject, body: emailBody }, recipient)

  const result = await sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
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
    subject: rendered.subject,
    body: rendered.text,
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
      description: rendered.subject,
    })
  }

  return NextResponse.json({ success: true, messageId: result.id, from: result.from })
}
