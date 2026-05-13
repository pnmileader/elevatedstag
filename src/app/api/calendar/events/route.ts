// REMOVED: Google Calendar API integration. Replaced by:
//   - GET /api/appointments/[id]/ics for individual invite downloads
//   - Supabase appointments table read directly from /calendar page
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: 'This endpoint has been removed. See SECURITY_AUDIT.md.' }),
    { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  )
}

export async function POST() {
  return new NextResponse(
    JSON.stringify({ error: 'This endpoint has been removed. Use POST /api/appointments instead.' }),
    { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  )
}
