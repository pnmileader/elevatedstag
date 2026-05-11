import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { to?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const to = body.to?.trim()
  if (!to) {
    return NextResponse.json({ success: false, error: 'to is required' }, { status: 400 })
  }

  const result = await sendEmail({
    to,
    subject: 'The Elevated Stag — Resend test',
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1A1814;">
        <h1 style="font-size: 20px; font-weight: 500; margin-bottom: 12px;">Resend test email</h1>
        <p>This is a test message from the Elevated Stag CRM, sent via Resend.</p>
        <p>If you received this, the integration is working:</p>
        <ul>
          <li>From: <code>katie@mail.theelevatedstag.com</code></li>
          <li>Reply-to: <code>katie@theelevatedstag.com</code></li>
        </ul>
        <p style="color: #6B6560; font-size: 12px; margin-top: 32px;">
          Sent ${new Date().toISOString()}
        </p>
      </div>
    `,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, message: 'Resend returned an error' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    id: result.id,
    message: `Test email sent to ${to} (Resend id ${result.id})`,
  })
}
