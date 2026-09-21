// Run with: npx tsx src/lib/__tests__/dashboard.test.ts
import assert from 'node:assert/strict'
import { monthBounds, lineTotal, revenueBetween, groupRecentOrders, isInProgress, daysSince, type SaleLine } from '../dashboard'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const now = new Date(2026, 8, 20, 22, 30) // Sep 20 2026, 10:30pm local
const kline = { id: 'k', first_name: 'David', last_name: 'Kline' }
const line = (o: Partial<SaleLine>): SaleLine => ({ client_id: 'k', date: '2026-09-03', amount: 100, label: 'Suit', kind: 'custom', status: 'ordered', client: kline, ...o })

t('month bounds use local dates, even late at night', () => {
  assert.deepEqual(monthBounds(now), { thisMonthStart: '2026-09-01', lastMonthStart: '2026-08-01', lastMonthEnd: '2026-08-31' })
  assert.equal(monthBounds(new Date(2026, 0, 5)).lastMonthStart, '2025-12-01')
})
t('lineTotal = per-item price x quantity', () => {
  assert.equal(lineTotal(225, 3), 675)
  assert.equal(lineTotal('249', null), 249)
  assert.equal(lineTotal(null, 2), 0)
})
t('revenue sums custom + ready-made inside the window and counts orders, not lines', () => {
  const lines = [line({}), line({ amount: 50, kind: 'ready_made', label: 'Tie' }), line({ date: '2026-08-31', amount: 999 }), line({ client_id: 'z', amount: 10 })]
  assert.deepEqual(revenueBetween(lines, '2026-09-01'), { revenue: 160, orders: 2 })
  assert.deepEqual(revenueBetween(lines, '2026-08-01', '2026-08-31'), { revenue: 999, orders: 1 })
})
t('recent orders: David Kline buying 2 items on one day is ONE entry', () => {
  const g = groupRecentOrders([line({ amount: 219, label: 'Custom Shirt' }), line({ amount: 2349, label: 'Suit' }), line({ client_id: 'j', date: '2026-09-02', amount: 1249, client: { id: 'j', first_name: 'Jon', last_name: 'J' } })])
  assert.equal(g.length, 2)
  assert.equal(g[0].itemCount, 2)
  assert.equal(g[0].total, 2568)
  assert.deepEqual(g[0].labels, ['Custom Shirt', 'Suit'])
})
t('in progress ignores delivered and anything older than the window', () => {
  assert.equal(isInProgress({ status: 'ordered', order_date: '2026-09-01' }, now), true)
  assert.equal(isInProgress({ status: 'delivered', order_date: '2026-09-01' }, now), false)
  assert.equal(isInProgress({ status: 'ordered', order_date: '2025-11-12' }, now), false)
})
t('daysSince', () => assert.equal(daysSince('2026-09-10', now), 10))
console.log(`dashboard: ${passed} passed`)
