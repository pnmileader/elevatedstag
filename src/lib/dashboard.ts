// Pure dashboard math — kept out of the page so it can be unit tested.

export type SaleLine = {
  client_id: string | null
  date: string | null // YYYY-MM-DD
  amount: number // line total
  label: string
  kind: 'custom' | 'ready_made'
  status?: string | null
  client?: { id: string; first_name: string | null; last_name: string | null } | null
}

/** YYYY-MM-DD from LOCAL date parts. toISOString() shifts to UTC, which moves
 *  month boundaries by a day for anyone east of Greenwich or late at night. */
export function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function monthBounds(now: Date) {
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    thisMonthStart: localISODate(thisStart),
    lastMonthStart: localISODate(lastStart),
    lastMonthEnd: localISODate(lastEnd),
  }
}

/** A ready-made row stores the per-item price plus a quantity. */
export function lineTotal(price: number | string | null | undefined, quantity?: number | string | null): number {
  const p = Number(price) || 0
  const q = Number(quantity)
  return p * (Number.isFinite(q) && q > 0 ? q : 1)
}

export function revenueBetween(lines: SaleLine[], from: string, to?: string) {
  const inRange = lines.filter((l) => l.date && l.date >= from && (!to || l.date <= to))
  const orders = new Set(inRange.map((l) => `${l.client_id}|${l.date}`))
  return {
    revenue: Math.round(inRange.reduce((sum, l) => sum + l.amount, 0) * 100) / 100,
    orders: orders.size,
  }
}

export type OrderGroup = {
  key: string
  client: SaleLine['client']
  date: string
  itemCount: number
  total: number
  labels: string[]
  allDelivered: boolean
}

/** One entry per client per order date — not one per line item. */
export function groupRecentOrders(lines: SaleLine[], limit = 5): OrderGroup[] {
  const groups = new Map<string, OrderGroup>()
  for (const l of lines) {
    if (!l.date || !l.client_id) continue
    const key = `${l.client_id}|${l.date}`
    let g = groups.get(key)
    if (!g) {
      g = { key, client: l.client ?? null, date: l.date, itemCount: 0, total: 0, labels: [], allDelivered: true }
      groups.set(key, g)
    }
    g.itemCount += 1
    g.total += l.amount
    if (l.label && !g.labels.includes(l.label)) g.labels.push(l.label)
    if (l.kind === 'custom' && l.status !== 'delivered') g.allDelivered = false
    if (!g.client && l.client) g.client = l.client
  }
  return [...groups.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.total - a.total))
    .slice(0, limit)
}

/** "In progress" = not delivered AND recent. Imported history arrives as
 *  'ordered', so without the recency window hundreds of old orders count. */
export function isInProgress(order: { status: string | null; order_date: string | null }, now: Date, windowDays = 180): boolean {
  if (!order.status || order.status === 'delivered') return false
  if (!order.order_date) return true
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - windowDays)
  return order.order_date >= localISODate(cutoff)
}

export function daysSince(dateStr: string, now: Date): number {
  const then = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr)
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000)
}
