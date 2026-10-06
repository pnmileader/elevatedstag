// Run with: npx tsx src/lib/__tests__/careItems.test.ts
import assert from 'node:assert/strict'
import { careLabel, parseLocalDate, formatDueDate, isOverdue, latestThankYouNote, listableCareItems, type CareItemLike } from '../careItems'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const item = (o: Partial<CareItemLike>): CareItemLike => ({ id: 'x', item_type: 'to_do', title: 'Drop off shoes', completed: false, completed_at: null, due_date: null, created_at: '2026-10-01T12:00:00Z', ...o })

t('labels: new types and the old ones map onto To Do / Follow Up', () => {
  assert.equal(careLabel('to_do'), 'To Do')
  assert.equal(careLabel('follow_up'), 'Follow Up')
  assert.equal(careLabel('custom'), 'To Do')
  assert.equal(careLabel('follow_up_2week'), 'Follow Up')
  assert.equal(careLabel('follow_up_3month'), 'Follow Up')
  assert.equal(careLabel('thank_you_note'), 'Thank You Note')
  assert.equal(careLabel(null), 'To Do')
})

t('a due date is a calendar day, not UTC midnight (10/12 must not show as 10/11 in Austin)', () => {
  const d = parseLocalDate('2026-10-12')!
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 9)
  assert.equal(d.getDate(), 12)
  assert.equal(formatDueDate('2026-10-12'), '10/12/2026')
  assert.equal(parseLocalDate(null), null)
  assert.equal(parseLocalDate('garbage'), null)
})

t('overdue only once the due day has fully passed', () => {
  const eveningBefore = new Date(2026, 9, 11, 21, 0)
  const sameDayLate = new Date(2026, 9, 12, 23, 30)
  const nextMorning = new Date(2026, 9, 13, 8, 0)
  assert.equal(isOverdue(item({ due_date: '2026-10-12' }), eveningBefore), false)
  assert.equal(isOverdue(item({ due_date: '2026-10-12' }), sameDayLate), false)
  assert.equal(isOverdue(item({ due_date: '2026-10-12' }), nextMorning), true)
  assert.equal(isOverdue(item({ due_date: '2026-10-12', completed: true }), nextMorning), false)
  assert.equal(isOverdue(item({ due_date: null }), nextMorning), false)
})

t('the Thank You Note line uses the newest thank-you item; the list leaves thank-you items out', () => {
  const items = [
    item({ id: 'a', item_type: 'thank_you_note', created_at: '2026-05-01T00:00:00Z', completed: true }),
    item({ id: 'b', item_type: 'thank_you_note', created_at: '2026-09-01T00:00:00Z', completed: false }),
    item({ id: 'c', item_type: 'follow_up' }),
    item({ id: 'd', item_type: 'custom' }),
  ]
  assert.equal(latestThankYouNote(items)?.id, 'b')
  assert.deepEqual(listableCareItems(items).map((i) => i.id), ['c', 'd'])
  assert.equal(latestThankYouNote([item({})]), null)
})

console.log(`careItems: ${passed} passed`)
