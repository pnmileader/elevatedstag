// Run with: npx tsx src/lib/__tests__/measurementMath.test.ts
import assert from 'node:assert/strict'
import { FRACTIONS, addFit, fromEighths, toEighths, parseMeasurement, formatMeasurement } from '../measurementMath'
let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const v = (whole: string, fraction = '') => ({ whole, fraction })
const total = (a: string, f: string) => {
  const r = addFit(parseMeasurement(a), parseMeasurement(f))
  return r ? formatMeasurement(r) : null
}

t('FRACTIONS index is the number of eighths', () => {
  assert.deepEqual([...FRACTIONS], ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'])
  FRACTIONS.forEach((f, i) => assert.equal(toEighths(v('0', f)), i))
})
t('to/from eighths round-trip', () => {
  assert.equal(toEighths(v('39', '1/4')), 314)
  assert.deepEqual(fromEighths(314), v('39', '1/4'))
  assert.deepEqual(fromEighths(352), v('44', ''))
  assert.equal(toEighths(v('', '')), null)
  assert.equal(toEighths(v('', '3/8')), 3)
})
t('client examples: 39 1/4 + 5 = 44 1/4, 35 1/2 + 4 3/4 = 40 1/4', () => {
  assert.equal(total('39 1/4', '5'), '44 1/4')
  assert.equal(total('35 1/2', '4 3/4'), '40 1/4')
})
t('eighths carry into the whole number and reduce', () => {
  assert.equal(total('40 7/8', '1/8'), '41')
  assert.equal(total('40 5/8', '3/8'), '41')
  assert.equal(total('40 3/8', '5/8'), '41')
  assert.equal(total('32 3/4', '3 3/4'), '36 1/2')
  assert.equal(total('32 7/8', '7/8'), '33 3/4')
  assert.equal(total('32 1/8', '1/8'), '32 1/4')
  assert.equal(total('32 1/4', '1/4'), '32 1/2')
  assert.equal(total('32 3/8', '1/8'), '32 1/2')
  assert.equal(total('32 1/8', '3/8'), '32 1/2')
})
t('blank fit counts as zero; blank actual gives no total', () => {
  assert.equal(total('42', ''), '42')
  assert.equal(total('42 3/8', ''), '42 3/8')
  assert.equal(addFit(v('', ''), v('5', '')), null)
  assert.equal(addFit(undefined, v('5', '')), null)
  assert.deepEqual(addFit(v('42', ''), undefined), v('42', ''))
  assert.deepEqual(addFit(v('', '1/2'), v('', '1/2')), v('1', ''))
})
t('values that are not exact eighths never produce a rounded total', () => {
  assert.equal(addFit(v('40', '1/3'), v('2', '')), null)
  assert.equal(addFit(v('40', ''), v('2', '1/3')), null)
  assert.equal(addFit(v('abc', ''), v('2', '')), null)
  assert.deepEqual(addFit(v('40.5', ''), v('1', '1/2')), v('42', '')) // legacy decimal that is an exact eighth
  assert.equal(addFit(v('40.1', ''), v('1', '')), null)
})
t('stored format round-trips through parse/format', () => {
  for (const s of ['44 1/4', '44', '7/8', '16 1/2']) assert.equal(formatMeasurement(parseMeasurement(s)), s)
})
console.log(`measurementMath: ${passed} passed`)
