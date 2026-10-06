// Run with: npx tsx src/lib/__tests__/googleIcal.test.ts
import assert from 'node:assert/strict'
import { parseIcalEvents, isAllowedIcalUrl } from '../googleIcal'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }

// Shaped like Google Calendar's "secret address in iCal format" export.
const FEED = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'X-WR-TIMEZONE:America/Chicago',
  'BEGIN:VTIMEZONE',
  'TZID:America/Chicago',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0500',
  'TZNAME:CDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0600',
  'TZNAME:CST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
  // Weekly Monday 9am staff meeting; Oct 12 skipped, Oct 19 moved to 11am.
  'BEGIN:VEVENT',
  'UID:weekly-123@google.com',
  'SUMMARY:Staff meeting',
  'DTSTART;TZID=America/Chicago:20260928T090000',
  'DTEND;TZID=America/Chicago:20260928T093000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO',
  'EXDATE;TZID=America/Chicago:20261012T090000',
  'LOCATION:Studio',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly-123@google.com',
  'RECURRENCE-ID;TZID=America/Chicago:20261019T090000',
  'SUMMARY:Staff meeting (moved)',
  'DTSTART;TZID=America/Chicago:20261019T110000',
  'DTEND;TZID=America/Chicago:20261019T113000',
  'END:VEVENT',
  // All-day event
  'BEGIN:VEVENT',
  'UID:allday-1@google.com',
  'SUMMARY:Trunk show',
  'DTSTART;VALUE=DATE:20261014',
  'DTEND;VALUE=DATE:20261015',
  'END:VEVENT',
  // A CRM invite that landed on her Google calendar — the CRM already shows it.
  'BEGIN:VEVENT',
  'UID:appointment-abc-owner@theelevatedstag.com',
  'SUMMARY:Fitting - Harish Abbott',
  'DTSTART:20261015T150000Z',
  'DTEND:20261015T160000Z',
  'END:VEVENT',
  // Cancelled
  'BEGIN:VEVENT',
  'UID:cancelled-1@google.com',
  'SUMMARY:Cancelled lunch',
  'STATUS:CANCELLED',
  'DTSTART:20261016T170000Z',
  'DTEND:20261016T180000Z',
  'END:VEVENT',
  // Outside the window
  'BEGIN:VEVENT',
  'UID:old-1@google.com',
  'SUMMARY:Old thing',
  'DTSTART:20250101T170000Z',
  'DTEND:20250101T180000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const rangeStart = new Date('2026-10-04T05:00:00Z') // Sun Oct 4, midnight Austin
const rangeEnd = new Date('2026-10-25T04:59:59Z') // Sat Oct 24, end of day Austin

t('expands repeating events, honours skipped and moved occurrences', () => {
  const events = parseIcalEvents(FEED, rangeStart, rangeEnd)
  const staff = events.filter((e) => e.title.startsWith('Staff meeting'))
  assert.deepEqual(staff.map((e) => e.start), [
    '2026-10-05T14:00:00.000Z', // 9am CDT
    '2026-10-19T16:00:00.000Z', // moved to 11am
  ])
  assert.equal(staff[1].title, 'Staff meeting (moved)')
  assert.equal(staff[0].location, 'Studio')
  assert.equal(staff[0].allDay, false)
})

t('all-day events keep their calendar day', () => {
  const show = parseIcalEvents(FEED, rangeStart, rangeEnd).find((e) => e.title === 'Trunk show')!
  assert.equal(show.allDay, true)
  assert.equal(show.start, '2026-10-14')
})

t('leaves out CRM invites, cancelled events, and anything outside the window; sorted by start', () => {
  const events = parseIcalEvents(FEED, rangeStart, rangeEnd)
  const titles = events.map((e) => e.title)
  assert.ok(!titles.includes('Fitting - Harish Abbott'))
  assert.ok(!titles.includes('Cancelled lunch'))
  assert.ok(!titles.includes('Old thing'))
  assert.deepEqual(titles, ['Staff meeting', 'Trunk show', 'Staff meeting (moved)'])
  assert.equal(new Set(events.map((e) => e.id)).size, events.length)
})

t('garbage input yields no events instead of throwing', () => {
  assert.deepEqual(parseIcalEvents('not a calendar', rangeStart, rangeEnd), [])
})

t('only Google calendar https URLs are fetched', () => {
  assert.equal(isAllowedIcalUrl('https://calendar.google.com/calendar/ical/katie%40theelevatedstag.com/private-abc/basic.ics'), true)
  assert.equal(isAllowedIcalUrl('http://calendar.google.com/calendar/ical/x/basic.ics'), false)
  assert.equal(isAllowedIcalUrl('https://evil.example.com/basic.ics'), false)
  assert.equal(isAllowedIcalUrl(''), false)
})

console.log(`googleIcal: ${passed} passed`)
