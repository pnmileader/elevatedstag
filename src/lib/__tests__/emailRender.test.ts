// Run with: npx tsx src/lib/__tests__/emailRender.test.ts
import assert from 'node:assert/strict'
import { normalizeNewlines, personalize, textToHtml, renderEmail, looksLikeHtml } from '../emailRender'

let passed = 0
function t(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const STORED = "Hi {FIRST_NAME},\\n\\nI hope all is well!\\n\\nAll my best,\\nKatie" // literal backslash-n, as seeded

t('literal backslash-n becomes a real newline', () => {
  const out = normalizeNewlines(STORED)
  assert.ok(!out.includes('\\n'))
  assert.equal(out.split('\n').length, 6)
})
t('FIRST_NAME / LAST_NAME replaced, any case', () => {
  assert.equal(personalize('Hi {FIRST_NAME} {last_name}', { first_name: 'James', last_name: 'Bettersworth' }), 'Hi James Bettersworth')
})
t('no recipient -> "there", never the raw placeholder', () => {
  assert.equal(personalize('Hi {FIRST_NAME},', null), 'Hi there,')
})
t('html output has paragraphs + <br>, and is escaped', () => {
  const html = textToHtml('Line one\nLine two\n\n<script>x</script>')
  assert.ok(html.includes('Line one<br>Line two'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
})
t('renderEmail end-to-end on the seeded template', () => {
  const r = renderEmail({ subject: "Let's get together, {FIRST_NAME}!", body: STORED }, { first_name: 'James', last_name: 'B' })
  assert.equal(r.subject, "Let's get together, James!")
  assert.ok(r.text.startsWith('Hi James,\n\nI hope all is well!'))
  assert.ok(!r.text.includes('{FIRST_NAME}') && !r.text.includes('\\n'))
  assert.ok(r.html.includes('All my best,<br>Katie'))
  assert.ok(!r.html.includes('\\n') && !r.html.includes('{FIRST_NAME}'))
})
t('existing HTML bodies pass through un-escaped', () => {
  assert.ok(looksLikeHtml('<p>Hi {FIRST_NAME}</p>'))
  assert.equal(renderEmail({ subject: 's', body: '<p>Hi {FIRST_NAME}</p>' }, { first_name: 'Al' }).html, '<p>Hi Al</p>')
})
console.log(`emailRender: ${passed} passed`)
