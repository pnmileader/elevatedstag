// Date-only columns (order_date, due_date, need_by_date, …) come back as "YYYY-MM-DD".
// `new Date('2026-10-12')` reads that as UTC midnight, which is still Oct 11 in Austin,
// so every screen that rendered it in the browser showed the day before.

export function parseDateOnly(value: string | null | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDateOnly(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const d = parseDateOnly(value)
  return d ? d.toLocaleDateString('en-US', options) : ''
}

/** Whole calendar days from today to a date-only value (0 = today, negative = past). */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDateOnly(value)
  if (!d) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - today.getTime()) / 86_400_000) // round absorbs DST's 23/25-hour days
}

/** YYYY-MM-DD for the same day `months` calendar months back (clamped to the month's last day). */
export function monthsAgoISO(months: number, now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(now.getDate(), lastDay))
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${target.getFullYear()}-${m}-${d}`
}

/** YYYY-MM-DD from LOCAL date parts. toISOString() shifts to UTC, which moves the day
 *  for anyone east of Greenwich or late at night. */
export function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
