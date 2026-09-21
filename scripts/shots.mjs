// Dev helper: log in and screenshot key pages. Usage: node scripts/shots.mjs <label> [path ...]
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const [label = 'shot', ...paths] = process.argv.slice(2)
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001'
const out = process.env.SHOTS_DIR || './test-results/shots'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
for (const [vpName, viewport] of [['ipad', { width: 768, height: 1024 }], ['iphone', { width: 375, height: 812 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', process.env.E2E_EMAIL)
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 })
  for (const p of paths.length ? paths : ['/']) {
    await page.goto(`${BASE}${p}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(600)
    const name = `${label}-${vpName}-${p.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`
    await page.screenshot({ path: `${out}/${name}` })
    console.log('saved', name, errors.length ? 'pageerrors: ' + errors.join(' | ') : '')
  }
  await ctx.close()
}
await browser.close()
