// Read-only view of Katie's Google Calendar inside the CRM, via the calendar's
// "Secret address in iCal format" (Google Calendar → Settings → Integrate calendar).
// No Google sign-in or stored tokens: the server fetches that private feed and
// expands it for the dates on screen.
import ICAL from 'ical.js'

export type ExternalEvent = {
  id: string
  title: string
  /** ISO timestamp for timed events; YYYY-MM-DD for all-day events. */
  start: string
  end: string
  allDay: boolean
  location: string | null
}

/** Appointments the CRM emailed to Katie's calendar — already on the CRM calendar, so not repeated. */
const CRM_UID = /^appointment-.*@theelevatedstag\.com$/i
const MAX_OCCURRENCES = 1000

export function isAllowedIcalUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'calendar.google.com'
  } catch {
    return false
  }
}

function dateOnly(t: ICAL.Time): string {
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

function toEvent(uid: string, start: ICAL.Time, end: ICAL.Time, item: ICAL.Event): ExternalEvent {
  const allDay = start.isDate
  return {
    id: `${uid}|${start.toString()}`,
    title: item.summary || '(No title)',
    start: allDay ? dateOnly(start) : start.toJSDate().toISOString(),
    end: allDay ? dateOnly(end) : end.toJSDate().toISOString(),
    allDay,
    location: item.location || null,
  }
}

function overlaps(start: ICAL.Time, end: ICAL.Time, rangeStart: Date, rangeEnd: Date): boolean {
  if (start.isDate) {
    // All-day: compare as calendar days so the event isn't shifted by time zone.
    const s = new Date(start.year, start.month - 1, start.day)
    const e = new Date(end.year, end.month - 1, end.day)
    const rs = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
    return s <= rangeEnd && e > rs
  }
  return start.toJSDate() <= rangeEnd && end.toJSDate() > rangeStart
}

function isCancelled(component: ICAL.Component): boolean {
  return String(component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED'
}

const DAY_MS = 86_400_000
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

/**
 * Katie's feed holds every event she has ever had (8,000+, ~4 MB), and a full parse takes seconds.
 * Before parsing, drop one-off events that can't touch the range, judged from the raw DTSTART/DTEND
 * dates with a 2-day margin for time zones. Recurring series and their moved/edited occurrences are
 * always kept, since an old series can still land in range.
 */
export function slimIcs(ics: string, rangeStart: Date, rangeEnd: Date): string {
  const from = ymd(new Date(rangeStart.getTime() - 2 * DAY_MS))
  const to = ymd(new Date(rangeEnd.getTime() + 2 * DAY_MS))
  return ics.replace(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT\r?\n?/g, (block) => {
    if (/^(RRULE|RDATE|RECURRENCE-ID)[;:]/m.test(block)) return block
    const start = block.match(/^DTSTART[^:\r\n]*:(\d{8})/m)?.[1]
    if (!start) return block
    const end = block.match(/^DTEND[^:\r\n]*:(\d{8})/m)?.[1] ?? start
    return start <= to && end >= from ? block : ''
  })
}

export function parseIcalEvents(ics: string, rangeStart: Date, rangeEnd: Date): ExternalEvent[] {
  let root: ICAL.Component
  try {
    root = new ICAL.Component(ICAL.parse(slimIcs(ics, rangeStart, rangeEnd)))
  } catch {
    return []
  }

  for (const tz of root.getAllSubcomponents('vtimezone')) {
    const tzid = String(tz.getFirstPropertyValue('tzid') || '')
    if (tzid && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(tz)
  }

  // Masters first, then attach moved/edited occurrences (same UID + RECURRENCE-ID) to them.
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []
  for (const component of root.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(component)
    if (!event.uid || CRM_UID.test(event.uid)) continue
    if (event.isRecurrenceException()) exceptions.push(event)
    else masters.set(event.uid, event)
  }
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex)

  const out: ExternalEvent[] = []
  for (const [uid, event] of masters) {
    if (!event.startDate) continue
    if (!event.isRecurring()) {
      if (isCancelled(event.component)) continue
      const end = event.endDate ?? event.startDate
      if (overlaps(event.startDate, end, rangeStart, rangeEnd)) out.push(toEvent(uid, event.startDate, end, event))
      continue
    }
    if (isCancelled(event.component)) continue
    const it = event.iterator()
    for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES; i++, next = it.next()) {
      if (next.toJSDate() > rangeEnd) break
      const details = event.getOccurrenceDetails(next)
      if (isCancelled(details.item.component)) continue
      if (overlaps(details.startDate, details.endDate, rangeStart, rangeEnd)) {
        out.push(toEvent(uid, details.startDate, details.endDate, details.item))
      }
    }
  }

  return out.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
}

/** All-day events sort at the start of their day. */
function sortKey(e: ExternalEvent): string {
  return e.allDay ? `${e.start}T00:00:00.000Z` : e.start
}
