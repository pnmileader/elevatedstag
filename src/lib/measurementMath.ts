// Measurement arithmetic in eighths of an inch.
//
// Measurements are entered as a whole-number box plus a fraction select, and
// stored as strings like "44 1/4". The fraction options are the eighths of an
// inch, so FRACTIONS[i] is exactly i/8 — that index is what makes the math
// below exact (no floating point, no rounding).

export const FRACTIONS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'] as const

export type MeasurementValue = { whole: string; fraction: string }

/** "44 1/4" → { whole: '44', fraction: '1/4' }. Anything unrecognised lands in `whole` untouched. */
export function parseMeasurement(raw: string): MeasurementValue {
  const str = String(raw).trim()
  const match = str.match(/^(\d+)?\s*(\d\/\d)?$/)
  if (match) return { whole: match[1] || '', fraction: match[2] || '' }
  return { whole: str, fraction: '' }
}

/** { whole: '44', fraction: '1/4' } → "44 1/4" (the stored format). */
export function formatMeasurement(v: MeasurementValue): string {
  if (v.fraction) return `${v.whole} ${v.fraction}`.trim()
  return v.whole
}

function isBlank(v: MeasurementValue | null | undefined): boolean {
  return !v || (!String(v.whole ?? '').trim() && !String(v.fraction ?? '').trim())
}

/**
 * Whole + fraction → a count of eighths. Returns null for a blank value or one
 * that is not an exact number of eighths (e.g. "1/3", or text), so callers never
 * show a silently rounded total.
 */
export function toEighths(v: MeasurementValue | null | undefined): number | null {
  if (!v || isBlank(v)) return null
  const whole = String(v.whole ?? '').trim()
  const fraction = String(v.fraction ?? '').trim()
  let total = 0
  if (whole) {
    if (!/^\d+(\.\d+)?$/.test(whole)) return null
    const w = Number(whole) * 8
    if (!Number.isInteger(w)) return null
    total += w
  }
  if (fraction) {
    const m = fraction.match(/^(\d+)\/(\d+)$/)
    if (!m) return null
    const num = Number(m[1])
    const den = Number(m[2])
    if (den === 0 || 8 % den !== 0) return null
    total += num * (8 / den)
  }
  return total
}

/** A count of eighths → whole + reduced fraction (one of FRACTIONS). */
export function fromEighths(eighths: number): MeasurementValue {
  const n = Math.max(0, Math.round(eighths))
  return { whole: String(Math.floor(n / 8)), fraction: FRACTIONS[n % 8] }
}

/**
 * Finished total = actual + fit. Null until the actual value is present; a
 * blank fit counts as 0. Null too if either value is not an exact eighth.
 */
export function addFit(
  actual: MeasurementValue | null | undefined,
  fit: MeasurementValue | null | undefined,
): MeasurementValue | null {
  const a = toEighths(actual)
  if (a === null) return null
  const f = isBlank(fit) ? 0 : toEighths(fit)
  if (f === null) return null
  return fromEighths(a + f)
}
