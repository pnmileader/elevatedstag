// REMOVED: Gmail OAuth is no longer an active integration.
// Email sends now via Resend (see src/lib/email.ts).
// Calendar invites are delivered as .ics attachments (see src/lib/calendar.ts).
// This route is intentionally a tombstone — return 410 Gone instead of redirecting
// to Google's OAuth screen, so accidental traffic doesn't get prompted to grant a
// scope that the app can't honor.

import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: 'This endpoint has been removed. See SECURITY_AUDIT.md.' }),
    { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  )
}
