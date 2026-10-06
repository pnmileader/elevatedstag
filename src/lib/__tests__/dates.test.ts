// Run with: npx tsx src/lib/__tests__/dates.test.ts
import assert from 'node:assert/strict'
import { parseDateOnly, formatDateOnly, daysUntil } from '../dates'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }

t('a date-only value keeps its calendar day', () => {
  assert.equal(parseDateOnly('2026-05-07')!.getDate(), 7)
  assert.equal(formatDateOnly('2026-05-07'), '5/7/2026')
  assert.equal(formatDateOnly('2026-10-19', { month: 'short', day: 'numeric' }), 'Oct 19')
  assert.equal(formatDateOnly(null), '')
})
t('days until counts calendar days, whatever the time of day', () => {
  const lateEvening = new Date(2026, 9, 5, 22, 0)
  assert.equal(daysUntil('2026-10-12', lateEvening), 7)
  assert.equal(daysUntil('2026-10-05', lateEvening), 0)
  assert.equal(daysUntil('2026-10-04', lateEvening), -1)
  assert.equal(daysUntil('2026-11-02', new Date(2026, 10, 1, 9)), 1) // across the DST change
  assert.equal(daysUntil(null), null)
})

console.log(`dates: ${passed} passed`)
