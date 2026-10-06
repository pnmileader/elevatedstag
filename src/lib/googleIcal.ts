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

export function parseIcalEvents(ics: string, rangeStart: Date, rangeEnd: Date): ExternalEvent[] {
  let root: ICAL.Component
  try {
    root = new ICAL.Component(ICAL.parse(ics))
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
