import assert from 'node:assert/strict'
import { generateAppointmentIcs } from '../calendar'
import { sendEmail } from '../email'

const SEND_REAL_EMAIL = process.env.SEND_TEST_EMAIL === '1'
const TEST_TO = process.env.TEST_EMAIL_TO || 'emersonsmith1@gmail.com'

async function run() {
  const startUtc = new Date()
  startUtc.setUTCDate(startUtc.getUTCDate() + 1)
  startUtc.setUTCHours(19, 0, 0, 0)
  const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000)

  const appointment = {
    id: 'test-' + Date.now(),
    appointment_type: 'wardrobe',
    title: 'Wardrobe Appointment - James Bettersworth',
    start_time: startUtc.toISOString(),
    end_time: endUtc.toISOString(),
    location: 'TES Studio, 110 W Faust St, San Antonio, TX',
    notes: 'Bring fabric swatches for navy suiting',
  }

  const client = {
    id: 'client-test-1',
    first_name: 'James',
    last_name: 'Bettersworth',
    email: TEST_TO,
    phone: '(512) 555-1234',
  }

  console.log('Generating .ics for appointment:', appointment.id)
  const result = generateAppointmentIcs(appointment, client)
  if (!result.success) {
    console.error('FAILED:', result.error)
    process.exit(1)
  }

  console.log('--- Generated .ics ---')
  console.log(result.value)
  console.log('--- end ---')

  const unfolded = result.value.replace(/\r\n[ \t]/g, '')

  assert.match(unfolded, /BEGIN:VCALENDAR/, 'should be a valid VCALENDAR block')
  assert.match(unfolded, /BEGIN:VEVENT/, 'should contain a VEVENT')
  assert.match(unfolded, new RegExp(`UID:appointment-${appointment.id}@theelevatedstag.com`), 'should have stable UID')
  assert.match(unfolded, /STATUS:CONFIRMED/, 'should have status CONFIRMED')
  assert.match(unfolded, /ORGANIZER.*katie@theelevatedstag.com/i, 'should have organizer')
  assert.match(unfolded, new RegExp(`ATTENDEE.*${TEST_TO}`, 'i'), 'should have attendee with email')
  assert.match(unfolded, /Wardrobe Appointment - James Bettersworth/, 'should embed title')
  assert.match(unfolded, /TES Studio/, 'should embed location')
  assert.match(unfolded, /Bring fabric swatches/, 'should embed notes')
  console.log('All assertions passed.')

  if (!SEND_REAL_EMAIL) {
    console.log('\n(SEND_TEST_EMAIL not set; skipping real email send. Re-run with SEND_TEST_EMAIL=1 to send.)')
    return
  }

  console.log(`\nSending real test email to ${TEST_TO} with .ics attached...`)
  const sendResult = await sendEmail({
    to: TEST_TO,
    subject: 'Your appointment with Katie at The Elevated Stag — TEST',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #222;">
        <p style="font-size: 16px; margin: 0 0 16px;">Hi James,</p>
        <p style="font-size: 16px; margin: 0 0 16px;">
          Confirming our <strong>Wardrobe Appointment</strong> on
          <strong>${startUtc.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}</strong> at <strong>${startUtc.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })}</strong>.
        </p>
        <p style="font-size: 16px; margin: 0 0 16px;">
          Tap the attached calendar invite to add this to your calendar.
        </p>
        <p style="font-size: 16px; margin: 24px 0 4px;">Looking forward to seeing you,</p>
        <p style="font-size: 16px; margin: 0; font-weight: 600;">Katie</p>
        <p style="font-size: 14px; color: #666; margin: 4px 0 0;">The Elevated Stag</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">This is a test email from the CRM. The appointment is fictional.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'appointment.ics',
        content: result.value,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  })

  if (!sendResult.success) {
    console.error('Email send failed:', sendResult.error)
    process.exit(1)
  }

  console.log('Email sent. Resend id:', sendResult.id)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
