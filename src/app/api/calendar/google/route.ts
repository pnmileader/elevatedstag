import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAllowedIcalUrl, parseIcalEvents } from '@/lib/googleIcal'

const MAX_RANGE_DAYS = 62
const FEED_TTL_MS = 5 * 60_000

// Google only refreshes the feed every few minutes. Next's fetch cache skips responses over 2 MB
// (Katie's feed is ~4 MB), so keep the last copy in memory for the warm server instance.
let feedCache: { url: string; text: string; at: number } | null = null

async function readFeed(url: string): Promise<string> {
  if (feedCache && feedCache.url === url && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.text
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`feed responded ${res.status}`)
  const text = await res.text()
  feedCache = { url, text, at: Date.now() }
  return text
}

// GET /api/calendar/google?start=ISO&end=ISO → Katie's Google Calendar events in that window (read-only).
// The feed URL is a secret (it grants read access to her calendar), so it lives only in the
// GOOGLE_CALENDAR_ICAL_URL env var and is fetched server-side.
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const feedUrl = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!isAllowedIcalUrl(feedUrl)) {
    return NextResponse.json({ configured: false, events: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const start = new Date(request.nextUrl.searchParams.get('start') || '')
  const end = new Date(request.nextUrl.searchParams.get('end') || '')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start || end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'start and end must be ISO dates at most 62 days apart' }, { status: 400 })
  }

  try {
    const events = parseIcalEvents(await readFeed(feedUrl!), start, end)
    return NextResponse.json({ configured: true, events }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[calendar/google] could not read the Google Calendar feed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { configured: true, events: [], error: 'Couldn’t load your Google Calendar right now.' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
