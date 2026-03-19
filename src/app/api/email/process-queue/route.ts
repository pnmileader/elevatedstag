import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/gmail'

export async function POST(request: Request) {
  // Optional: Add a secret key check for security
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  // In production, check against an environment variable
  // if (secret !== process.env.CRON_SECRET) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  const supabase = createClient()
  
  // Get pending emails that are due to be sent
  const { data: pendingEmails, error: fetchError } = await supabase
    .from('email_queue')
    .select('*, client:clients(first_name, last_name)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10) // Process in batches

  if (fetchError) {
    console.error('Error fetching pending emails:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return NextResponse.json({ message: 'No pending emails', processed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const email of pendingEmails) {
    try {
      // Send the email
      await sendEmail({ to: email.to_email, subject: email.subject, body: email.body })

      // Update status to sent
      await supabase
        .from('email_queue')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', email.id)

      // Log to sent_emails
      await supabase.from('sent_emails').insert({
        client_id: email.client_id,
        to_email: email.to_email,
        subject: email.subject,
        body: email.body,
        template_id: email.template_id,
        status: 'sent',
      })

      // Log activity
      await supabase.from('activity_log').insert({
        client_id: email.client_id,
        activity_type: 'email_sent',
        title: `Automated email sent`,
        description: email.subject,
      })

      // Update client's last_contact_date
      await supabase
        .from('clients')
        .update({ last_contact_date: new Date().toISOString().split('T')[0] })
        .eq('id', email.client_id)

      sent++
      console.log(`Sent email to ${email.to_email}: ${email.subject}`)

    } catch (error) {
      console.error(`Failed to send email ${email.id}:`, error)
      
      // Update status to failed
      await supabase
        .from('email_queue')
        .update({ 
          status: 'failed', 
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', email.id)

      failed++
    }
  }

  return NextResponse.json({ 
    message: 'Queue processed',
    processed: pendingEmails.length,
    sent,
    failed
  })
}

// Also allow GET for easy testing/manual trigger
export async function GET(request: Request) {
  return POST(request)
}
