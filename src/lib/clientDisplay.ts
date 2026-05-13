// Shared helpers for rendering a client's display name and avatar initials.
// Imported clients can have single-word names ("POD", "Zelle") or missing
// last_name entirely, so naive `${first} ${last}` and `first[0]+last[0]`
// produce "Sundefined" / undefined-suffixed garbage. Use these helpers.

export type DisplayClient = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
}

function nonEmpty(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function clientDisplayName(client: DisplayClient | null | undefined): string {
  if (!client) return '(unnamed client)'
  const first = nonEmpty(client.first_name)
  const last = nonEmpty(client.last_name)
  if (first && last) return `${first} ${last}`
  if (first) return first
  if (last) return last
  const company = nonEmpty(client.company)
  if (company) return company
  return '(unnamed client)'
}

export function clientInitials(client: DisplayClient | null | undefined): string {
  if (!client) return '?'
  const first = nonEmpty(client.first_name)
  const last = nonEmpty(client.last_name)
  if (first && last) return (first[0] + last[0]).toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  if (last) return last.slice(0, 2).toUpperCase()
  const company = nonEmpty(client.company)
  if (company) return company.slice(0, 2).toUpperCase()
  return '?'
}
