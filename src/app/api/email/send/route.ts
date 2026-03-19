import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/gmail'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, to, subject, emailBody, templateId } = body

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'to, subject, and emailBody are required' },
        { status: 400 }
      )
    }

    // Send the email
    const result = await sendEmail({
      to,
      subject,
      body: emailBody,
    })

    // Log the sent email
    const supabase = createClient()
    await supabase.from('sent_emails').insert({
      client_id: clientId || null,
      to_email: to,
      subject,
      body: emailBody,
      template_id: templateId || null,
      status: 'sent',
    })

    // Update client's last_contact_date if we have a client
    if (clientId) {
      await supabase
        .from('clients')
        .update({ last_contact_date: new Date().toISOString() })
        .eq('id', clientId)

      // Log activity
      await supabase.from('activity_log').insert({
        client_id: clientId,
        activity_type: 'email_sent',
        title: 'Email sent',
        description: subject,
      })
    }

    return NextResponse.json({ success: true, messageId: result.id })
  } catch (err) {
    console.error('Error sending email:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
