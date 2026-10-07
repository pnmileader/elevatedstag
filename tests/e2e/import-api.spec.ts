import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, cleanup, E2E_LAST_NAME } from './fixtures'

// Settings → Import's three API routes, signed in: clients, create-missing-clients, purchases.

let db: SupabaseClient

test.beforeAll(async () => {
  db = await signedInDb()
  await cleanup(db)
})

test.afterAll(async () => {
  await cleanup(db)
})

test('import clients → create missing clients → import purchases, each idempotent', async ({ page }) => {
  const clients = await page.request.post('/api/import/clients', {
    data: { rows: [{ first_name: 'Impy', last_name: E2E_LAST_NAME, phone: '(512) 555-0188' }] },
  })
  expect(await clients.json()).toMatchObject({ success: true, imported: 1 })
  const clientsAgain = await page.request.post('/api/import/clients', {
    data: { rows: [{ first_name: 'Impy', last_name: E2E_LAST_NAME, phone: '(512) 555-0188', billing_city: 'Austin' }] },
  })
  expect(await clientsAgain.json()).toMatchObject({ imported: 0, updated: 1 })

  const missing = await page.request.post('/api/import/missing-clients', { data: { names: [`Impy ${E2E_LAST_NAME}`, 'Missy Playwright'] } })
  expect(await missing.json()).toMatchObject({ success: true, created: 1, alreadyMatched: 1 })

  const rows = [
    { customer: 'Missy Playwright', date: '10/01/2026', invoice_id: 'E2E-IMP-1', product: 'Wardrobe Styling:CSHT - Custom Shirt', description: 'E2E blue twill', quantity: '1', amount: '249' },
    { customer: `Impy ${E2E_LAST_NAME}`, date: '10/01/2026', invoice_id: 'E2E-IMP-2', product: 'Wardrobe Styling:Socks', description: 'E2E socks', quantity: '3', amount: '60' },
  ]
  const purchases = await page.request.post('/api/import/purchases', { data: { rows } })
  expect(await purchases.json()).toMatchObject({ success: true, customCreated: 1, readyMadeCreated: 1 })
  const purchasesAgain = await page.request.post('/api/import/purchases', { data: { rows } })
  expect(await purchasesAgain.json()).toMatchObject({ customCreated: 0, readyMadeCreated: 0, unchanged: 2 })

  const { data } = await db.from('clients').select('first_name, last_purchase_date, billing_address').in('last_name', [E2E_LAST_NAME, 'Playwright']).order('first_name')
  expect(data!.map((c) => [c.first_name, c.last_purchase_date])).toEqual([['Impy', '2026-10-01'], ['Missy', '2026-10-01']])
  expect(data![0].billing_address).toMatchObject({ city: 'Austin' })
})
