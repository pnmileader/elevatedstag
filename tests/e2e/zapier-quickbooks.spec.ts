import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, cleanup, E2E_LAST_NAME } from './fixtures'

// Zapier → /api/zapier/quickbooks: QuickBooks customers and sales land in the CRM through the
// same matching / de-duplication as Settings → Import. No session; a shared secret header.

const NAME = `Zapy ${E2E_LAST_NAME}`
const SECRET = process.env.ZAPIER_WEBHOOK_SECRET || ''

let db: SupabaseClient
let api: APIRequestContext

const invoice = (docNumber: string) => ({
  Id: '990001',
  DocNumber: docNumber,
  TxnDate: new Date().toISOString().slice(0, 10),
  CustomerRef: { value: '990001', name: NAME },
  Line: [
    { Id: '1', LineNum: 1, Description: 'E2E white twill, French cuff', Amount: 498, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { name: 'Wardrobe Styling:CSHT - Custom Shirt' }, Qty: 2 } },
    { Id: '2', LineNum: 2, Description: 'E2E Lennox, 31', Amount: 450, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { name: 'Wardrobe Styling:Paige Jeans' }, Qty: 2 } },
    { Amount: 948, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} },
  ],
})

test.beforeAll(async ({ baseURL }) => {
  expect(SECRET.length, 'ZAPIER_WEBHOOK_SECRET must be in .env.local').toBeGreaterThanOrEqual(24)
  db = await signedInDb()
  await cleanup(db)
  api = await pwRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
})

test.afterAll(async () => {
  await cleanup(db)
  await api?.dispose()
})

test.describe('Zapier → QuickBooks webhook', () => {
  test('rejects a missing or wrong key', async () => {
    expect((await api.post('/api/zapier/quickbooks?type=sale', { data: invoice('E2E-1') })).status()).toBe(401)
    expect((await api.post('/api/zapier/quickbooks?type=sale', { data: invoice('E2E-1'), headers: { 'X-CRM-Key': 'x'.repeat(48) } })).status()).toBe(401)
  })

  test('new customer creates the client; sending it again changes nothing', async () => {
    const customer = { Customer: { GivenName: 'Zapy', FamilyName: E2E_LAST_NAME, DisplayName: NAME, Mobile: { FreeFormNumber: '(512) 555-0177' } } }
    const first = await api.post('/api/zapier/quickbooks?type=customer', { data: customer, headers: { 'X-CRM-Key': SECRET } })
    expect(first.status()).toBe(200)
    expect(await first.json()).toMatchObject({ success: true, outcome: 'created' })
    const again = await api.post('/api/zapier/quickbooks?type=customer', { data: customer, headers: { 'X-CRM-Key': SECRET } })
    expect(await again.json()).toMatchObject({ outcome: 'already up to date' })
    const { data } = await db.from('clients').select('first_name, phone, source').eq('last_name', E2E_LAST_NAME).eq('first_name', 'Zapy')
    expect(data).toEqual([{ first_name: 'Zapy', phone: '5125550177', source: 'quickbooks_zapier' }])
  })

  test('new invoice adds each garment once, as delivered; a re-sent invoice adds nothing', async () => {
    const res = await api.post('/api/zapier/quickbooks?type=sale', { data: invoice('E2E-2601'), headers: { 'X-CRM-Key': SECRET } })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, customer: NAME, customGarmentsAdded: 2, readyMadeAdded: 1 })

    const { data: client } = await db.from('clients').select('id, last_purchase_date').eq('last_name', E2E_LAST_NAME).eq('first_name', 'Zapy').single()
    expect(client!.last_purchase_date).toBe(new Date().toISOString().slice(0, 10))
    const { data: orders } = await db.from('custom_orders').select('garment_type, price, status, quickbooks_invoice_id').eq('client_id', client!.id)
    expect(orders).toEqual([
      { garment_type: 'Custom Shirt', price: 249, status: 'delivered', quickbooks_invoice_id: 'E2E-2601' },
      { garment_type: 'Custom Shirt', price: 249, status: 'delivered', quickbooks_invoice_id: 'E2E-2601' },
    ])
    const { data: ready } = await db.from('ready_made_purchases').select('brand, price, quantity, description').eq('client_id', client!.id)
    expect(ready).toEqual([{ brand: 'Paige', price: 225, quantity: 2, description: 'E2E Lennox, 31' }])

    const again = await api.post('/api/zapier/quickbooks?type=sale', { data: { Invoice: invoice('E2E-2601') }, headers: { 'X-CRM-Key': SECRET } })
    expect(await again.json()).toMatchObject({ customGarmentsAdded: 0, readyMadeAdded: 0, alreadyInCrm: 3 })
  })

  test('a sale for someone not in the CRM yet creates them', async () => {
    const data = { ...invoice('E2E-2602'), CustomerRef: { name: `Newby ${E2E_LAST_NAME}` } }
    const res = await api.post('/api/zapier/quickbooks?type=sale', { data, headers: { 'X-CRM-Key': SECRET } })
    expect(await res.json()).toMatchObject({ success: true, clientCreated: true, customGarmentsAdded: 2 })
    const { data: rows } = await db.from('clients').select('source').eq('last_name', E2E_LAST_NAME).eq('first_name', 'Newby')
    expect(rows).toEqual([{ source: 'quickbooks_zapier' }])
  })

  test('a payload it cannot read says why (shown in Zapier)', async () => {
    const res = await api.post('/api/zapier/quickbooks?type=sale', { data: { hello: 'world' }, headers: { 'X-CRM-Key': SECRET } })
    expect(res.status()).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'No customer name in the payload', keys: ['hello'] })
  })
})
