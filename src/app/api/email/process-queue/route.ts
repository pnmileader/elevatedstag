import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/emailAutomation'

type QueueRow = {
  id: string
  client_id: string | null
  to_email: string
  subject: string
  body: string
  template_id: string | null
  scheduled_for: string
  retry_count?: number | null
  client?: { first_name: string | null; last_name: string | null } | null
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const now = new Date()

  const { data: pendingEmails, error: fetchError } = await supabase
    .from('email_queue')
    .select('*, client:clients(first_name, last_name)')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error('[email] Failed to fetch queue:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return NextResponse.json({ message: 'No pending emails', processed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const raw of pendingEmails as QueueRow[]) {
    const email = raw
    const client = Array.isArray(email.client) ? email.client[0] : email.client

    const vars: Record<string, string> = {
      first_name: client?.first_name ?? '',
      last_name: client?.last_name ?? '',
    }

    const renderedSubject = renderTemplate(email.subject, vars)
    const renderedBody = renderTemplate(email.body, vars)

    const result = await sendEmail({
      to: email.to_email,
      subject: renderedSubject,
      html: renderedBody,
    })

    if (!result.success) {
      console.error(`[email] Failed to send queue row ${email.id}:`, result.error)
      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          error_message: result.error,
          retry_count: (email.retry_count ?? 0) + 1,
        })
        .eq('id', email.id)
      failed++
      continue
    }

    const sentAt = new Date().toISOString()

    await supabase
      .from('email_queue')
      .update({ status: 'sent', sent_at: sentAt })
      .eq('id', email.id)

    await supabase.from('sent_emails').insert({
      client_id: email.client_id,
      to_email: email.to_email,
      subject: renderedSubject,
      body: renderedBody,
      template_id: email.template_id,
      status: 'sent',
      sent_at: sentAt,
    })

    if (email.client_id) {
      await supabase.from('activity_log').insert({
        client_id: email.client_id,
        activity_type: 'email_sent',
        title: 'Automated email sent',
        description: renderedSubject,
      })

      await supabase
        .from('clients')
        .update({ last_contact_date: sentAt.split('T')[0] })
        .eq('id', email.client_id)
    }

    sent++
    console.log(`[email] sent queue=${email.id} client=${email.client_id ?? 'none'}`)
  }

  return NextResponse.json({
    message: 'Queue processed',
    processed: pendingEmails.length,
    sent,
    failed,
  })
}

export async function GET(request: Request) {
  return POST(request)
}
