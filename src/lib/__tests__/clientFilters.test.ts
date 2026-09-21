// Run with: npx tsx src/lib/__tests__/clientFilters.test.ts
import assert from 'node:assert/strict'
import { lastPurchaseBucket, addTag, removeTag, uniqueTags, matchesSearch } from '../clientFilters'
let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const now = new Date(2026, 8, 20)
t('last purchase buckets', () => {
  assert.equal(lastPurchaseBucket(null, now), 'never')
  assert.equal(lastPurchaseBucket('2026-08-01', now), 'under_3')
  assert.equal(lastPurchaseBucket('2026-05-07', now), '3_6')
  assert.equal(lastPurchaseBucket('2025-11-12', now), '6_12')
  assert.equal(lastPurchaseBucket('2025-06-06', now), 'over_12')
  assert.equal(lastPurchaseBucket('2026-06-20', now), '3_6') // exactly 3 months ago is no longer "under 3"
})
t('tags: add is case-insensitive, trims, never duplicates', () => {
  assert.deepEqual(addTag(['VP'], ' vp '), ['VP'])
  assert.deepEqual(addTag(['VP'], 'San  Antonio'), ['VP', 'San Antonio'])
  assert.deepEqual(addTag(null, 'FU'), ['FU'])
  assert.deepEqual(removeTag(['VP', 'FU'], 'fu'), ['VP'])
  assert.deepEqual(uniqueTags([['b', 'A'], null, ['a', 'C']]), ['A', 'b', 'C'])
})
t('search matches any part of the name, in any order', () => {
  const c = { first_name: 'James', last_name: 'Bettersworth', email: 'james@bettersworthlaw.com', phone: '(210) 555-0101' }
  assert.ok(matchesSearch(c, 'Bet'))
  assert.ok(matchesSearch(c, 'bettersworth james'))
  assert.ok(matchesSearch(c, '2105550101'))
  assert.ok(!matchesSearch(c, 'kline'))
})
console.log(`clientFilters: ${passed} passed`)
