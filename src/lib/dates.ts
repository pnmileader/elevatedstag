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
