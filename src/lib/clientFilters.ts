// Shared, pure client-list filters (Clients page + Compose Email).

export type LastPurchaseBucket = 'under_3' | '3_6' | '6_12' | 'over_12' | 'never'

export const LAST_PURCHASE_OPTIONS: Array<{ value: LastPurchaseBucket; label: string }> = [
  { value: 'under_3', label: 'Under 3 months' },
  { value: '3_6', label: '3–6 months' },
  { value: '6_12', label: '6–12 months' },
  { value: 'over_12', label: 'Over 12 months' },
  { value: 'never', label: 'Never' },
]

function monthsAgo(now: Date, months: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function lastPurchaseBucket(lastPurchaseDate: string | null | undefined, now: Date = new Date()): LastPurchaseBucket {
  if (!lastPurchaseDate) return 'never'
  const d = lastPurchaseDate.slice(0, 10)
  if (d > monthsAgo(now, 3)) return 'under_3'
  if (d > monthsAgo(now, 6)) return '3_6'
  if (d > monthsAgo(now, 12)) return '6_12'
  return 'over_12'
}

/** Tags are short codes ("VP", "FU") or places ("San Antonio"); compare case-insensitively, keep the first spelling. */
export function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/,/g, '').trim().slice(0, 40)
}

export function addTag(tags: string[] | null | undefined, raw: string): string[] {
  const tag = normalizeTag(raw)
  const current = tags || []
  if (!tag || current.some((t) => t.toLowerCase() === tag.toLowerCase())) return current
  return [...current, tag]
}

export function removeTag(tags: string[] | null | undefined, tag: string): string[] {
  return (tags || []).filter((t) => t.toLowerCase() !== tag.toLowerCase())
}

export function uniqueTags(lists: Array<string[] | null | undefined>): string[] {
  const seen = new Map<string, string>()
  for (const list of lists) for (const t of list || []) if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function matchesSearch(
  client: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null },
  query: string,
): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const hay = `${client.first_name || ''} ${client.last_name || ''} ${client.email || ''} ${(client.phone || '').replace(/\D/g, '')} ${client.phone || ''}`.toLowerCase()
  return tokens.every((t) => hay.includes(t))
}
