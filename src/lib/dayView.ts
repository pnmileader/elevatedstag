// Lays out one day the way Google Calendar's day view does: all-day items across the top,
// then timed items as boxes on an hour grid, side by side where they overlap.
import type { CalendarEntry } from './calendarView'

export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 18
const DEFAULT_MINUTES = 60
/** Shortest box drawn, so a 5-minute (or zero-length) event is still readable and tappable. */
export const MIN_BLOCK_MINUTES = 20

export type DayBlock = {
  entry: CalendarEntry
  /** Minutes after local midnight, clipped to the day. */
  startMin: number
  endMin: number
  col: number
  cols: number
}

export type DayLayout = { allDay: CalendarEntry[]; blocks: DayBlock[]; startHour: number; endHour: number }

const nextDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  const n = new Date(y, m - 1, d + 1)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** Local wall-clock minutes (not elapsed time, so the grid stays right on DST days). */
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

/** `day` is a local YYYY-MM-DD. Entries from other days are ignored. */
export function layoutDay(entries: CalendarEntry[], day: string): DayLayout {
  const tomorrow = nextDay(day)
  const [y, m, d] = day.split('-').map(Number)
  const dayStart = new Date(y, m - 1, d)
  const dayEnd = new Date(y, m - 1, d + 1)

  const allDay = entries.filter((e) => {
    if (!e.allDay) return false
    const start = e.start.slice(0, 10)
    const end = e.end && e.end.slice(0, 10) > start ? e.end.slice(0, 10) : nextDay(start) // end is exclusive
    return start <= day && day < end
  })

  const timed = entries
    .filter((e) => !e.allDay)
    .map((e) => {
      const start = new Date(e.start)
      const rawEnd = e.end ? new Date(e.end) : null
      const end = rawEnd && rawEnd > start ? rawEnd : new Date(start.getTime() + (rawEnd ? 0 : DEFAULT_MINUTES * 60_000))
      return { entry: e, start, end }
    })
    // Overlaps this day (an event ending exactly at midnight belongs to the day before).
    .filter(({ start, end }) => start < dayEnd && end > dayStart)
    .map(({ entry, start, end }) => {
      const startMin = localDay(start) < day ? 0 : minutesOf(start)
      const endMin = localDay(end) >= tomorrow ? 24 * 60 : minutesOf(end)
      return { entry, startMin, endMin: Math.min(24 * 60, Math.max(endMin, startMin + MIN_BLOCK_MINUTES)) }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Group events that overlap (directly or through a chain) and give each the first free column.
  const blocks: DayBlock[] = []
  let group: DayBlock[] = []
  let colEnds: number[] = []
  let groupEnd = -1
  const closeGroup = () => {
    for (const b of group) b.cols = colEnds.length
    group = []
    colEnds = []
  }
  for (const t of timed) {
    if (t.startMin >= groupEnd) closeGroup()
    let col = colEnds.findIndex((end) => end <= t.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(t.endMin)
    } else {
      colEnds[col] = t.endMin
    }
    const block: DayBlock = { ...t, col, cols: 1 }
    group.push(block)
    blocks.push(block)
    groupEnd = Math.max(groupEnd, t.endMin)
  }
  closeGroup()

  const startHour = Math.min(DEFAULT_START_HOUR, ...blocks.map((b) => Math.floor(b.startMin / 60)))
  const endHour = Math.min(24, Math.max(DEFAULT_END_HOUR, ...blocks.map((b) => Math.ceil(b.endMin / 60))))
  return { allDay, blocks, startHour, endHour }
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

/** "2:00 – 3:00 PM", "11:30 AM – 12:15 PM", or just "9:00 AM" without an end. */
export function formatTimeRange(start: string, end: string | null | undefined): string {
  const s = clock(new Date(start))
  if (!end || new Date(end) <= new Date(start)) return s
  const e = clock(new Date(end))
  const [sTime, sPeriod] = s.split(' ')
  return sPeriod === e.split(' ')[1] ? `${sTime} – ${e}` : `${s} – ${e}`
}

/** Hour label for the grid's left column: "8 AM", "12 PM". */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour % 24 < 12 ? 'AM' : 'PM'}`
}
