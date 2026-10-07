// Run with: npx tsx src/lib/__tests__/email.test.ts
import assert from 'node:assert/strict'
import { ownerBccFor } from '../email'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const KATIE = 'katie@theelevatedstag.com'

t('client emails BCC Katie', () => {
  assert.equal(ownerBccFor('shane@example.com', KATIE), KATIE)
  assert.equal(ownerBccFor(['a@example.com', 'b@example.com'], KATIE), KATIE)
})

t('no copy when the mail already goes to her, in any case', () => {
  assert.equal(ownerBccFor(' Katie@TheElevatedStag.com ', KATIE), undefined)
  assert.equal(ownerBccFor(['a@example.com', KATIE], KATIE), undefined)
})

t('test sends to Resend’s sink inboxes never copy her', () => {
  assert.equal(ownerBccFor('delivered@resend.dev', KATIE), undefined)
})

t('EMAIL_BCC=off (or empty) turns it off', () => {
  assert.equal(ownerBccFor('shane@example.com', 'off'), undefined)
  assert.equal(ownerBccFor('shane@example.com', ''), undefined)
})

console.log(`email: ${passed} passed`)
