// REMOVED: QBO OAuth-based sync. Replaced by CSV import at /settings/import.
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: 'This endpoint has been removed. See SECURITY_AUDIT.md.' }),
    { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  )
}
