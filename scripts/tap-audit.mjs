// Dev check: list visible interactive elements under 44x44px at phone width.
// Usage: node scripts/tap-audit.mjs   (dev server on :3001, tests/e2e/.auth/user.json present)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001'
const clientId = process.argv[2]
const paths = ['/', '/clients', '/orders', '/calendar', '/calendar/new', '/email', '/email/compose', '/email/templates', '/settings', '/settings/automations', '/settings/import', '/referrals', '/clients/new',
  ...(clientId ? [`/clients/${clientId}`, `/clients/${clientId}/edit`, `/clients/${clientId}/measurements`, `/clients/${clientId}/orders`, `/clients/${clientId}/purchases`, `/clients/${clientId}/swatches`] : [])]
const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: new URL('../tests/e2e/.auth/user.json', import.meta.url).pathname, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
let total = 0
for (const p of paths) {
  await page.goto(BASE + p); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700)
  const small = await page.evaluate(() => {
    const out = []
    const sel = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="checkbox"], input:not([type="hidden"]), select, textarea, summary'
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue
      if (el.closest('nextjs-portal')) continue
      // a small checkbox/radio inside a big <label> is fine — the label is the target
      const label = el.closest('label'); const lr = label?.getBoundingClientRect()
      if (lr && lr.height >= 44 && lr.width >= 44) continue
      // inline text links inside a sentence are exempt (WCAG 2.5.8 inline exception)
      if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && el.parentElement.innerText.trim().length > el.innerText.trim().length + 20) continue
      if (r.height < 43.5 || r.width < 43.5) out.push(`${Math.round(r.width)}x${Math.round(r.height)} <${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().slice(0, 38)}" .${(el.className?.toString() || '').split(' ').slice(0, 3).join('.')}`)
    }
    return out
  })
  total += small.length
  console.log(`\n${p.replace(clientId || '###', ':id')} — ${small.length} under 44px`)
  ;[...new Set(small)].slice(0, 14).forEach((s) => console.log('   ' + s))
}
console.log(`\nTOTAL under 44px: ${total}`)
await browser.close()
