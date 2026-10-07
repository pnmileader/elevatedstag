// Run with: npx tsx src/lib/__tests__/zapierQuickbooks.test.ts
import assert from 'node:assert/strict'
import { customerFromZapier, saleFromZapier, pick, LINE_SEPARATOR } from '../zapierQuickbooks'
import { planPurchaseImport, type ImportClient } from '../purchaseImport'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }

// Trimmed QuickBooks Online Invoice, as the API (and a Zapier "raw data" POST) returns it.
const INVOICE = {
  Id: '9123',
  DocNumber: '2601',
  TxnDate: '2026-10-07',
  CustomerRef: { value: '58', name: 'Shane Bailey' },
  Line: [
    { Id: '1', LineNum: 1, Description: 'White twill, French cuff', Amount: 498, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: '31', name: 'Wardrobe Styling:CSHT - Custom Shirt' }, UnitPrice: 249, Qty: 2 } },
    { Id: '2', LineNum: 2, Description: 'Chino: Dk. Blue, Burgundy', Amount: 500, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: '40', name: 'Blue Delta Jeans' }, UnitPrice: 500, Qty: 1 } },
    { Id: '3', LineNum: 3, Description: 'Deposit', Amount: 100, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: '9', name: 'Wardrobe Styling:Deposit' }, Qty: 1 } },
    { DetailType: 'GroupLineDetail', GroupLineDetail: { Line: [
      { Description: 'Silk, navy', Amount: 95, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { name: 'Wardrobe Styling:Tie' }, Qty: 1 } },
    ] } },
    { Amount: 50, DetailType: 'DiscountLineDetail', DiscountLineDetail: { PercentBased: false } },
    { Amount: 1193, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} },
  ],
}

t('reads a QuickBooks invoice: customer, DocNumber, date, item lines (incl. bundles); skips subtotal + discount', () => {
  const sale = saleFromZapier(INVOICE)
  assert.ok(!('error' in sale))
  assert.equal(sale.customer, 'Shane Bailey')
  assert.deepEqual(sale.rows.map((r) => [r.product, r.quantity, r.amount, r.invoice_id, r.date]), [
    ['Wardrobe Styling:CSHT - Custom Shirt', '2', '498', '2601', '2026-10-07'],
    ['Blue Delta Jeans', '1', '500', '2601', '2026-10-07'],
    ['Wardrobe Styling:Deposit', '1', '100', '2601', '2026-10-07'],
    ['Wardrobe Styling:Tie', '1', '95', '2601', '2026-10-07'],
  ])
  assert.equal(sale.rows[1].description, 'Chino: Dk. Blue, Burgundy', 'commas in descriptions survive')
})

t('wrapped ({ Invoice }) and sales receipts read the same', () => {
  const a = saleFromZapier({ Invoice: INVOICE })
  const b = saleFromZapier({ SalesReceipt: INVOICE })
  assert.ok(!('error' in a) && !('error' in b))
  assert.equal(a.rows.length, 4)
  assert.equal(b.rows.length, 4)
})

t('Zapier-flattened keys ("CustomerRef__name") and any key case', () => {
  assert.equal(pick({ CustomerRef__name: 'Ann Lee' }, 'CustomerRef.name'), 'Ann Lee')
  assert.equal(pick({ customerref: { NAME: 'Ann Lee' } }, 'CustomerRef.name'), 'Ann Lee')
  const sale = saleFromZapier({ CustomerRef__name: 'Ann Lee', DocNumber: 7, TxnDate: '2026-10-01', Line: INVOICE.Line.slice(0, 1) })
  assert.ok(!('error' in sale))
  assert.equal(sale.rows[0].invoice_id, '7')
})

t('feeds the planner like a sales-report row: 2 shirts at $249, jeans as ready-made, deposit skipped', () => {
  const sale = saleFromZapier(INVOICE)
  assert.ok(!('error' in sale))
  const clients: ImportClient[] = [{ id: 'shane', first_name: 'Shane', last_name: 'Bailey' }]
  const plan = planPurchaseImport(sale.rows, clients, [], new Date('2026-10-07T12:00:00Z'))
  const custom = plan.inserts.filter((i) => i.kind === 'custom').map((i) => i.payload)
  const ready = plan.inserts.filter((i) => i.kind === 'ready_made').map((i) => i.payload)
  assert.deepEqual(custom.map((p) => [p.garment_type, p.price, p.quickbooks_invoice_id, p.status]), [
    ['Custom Shirt', 249, '2601', 'delivered'], ['Custom Shirt', 249, '2601', 'delivered'],
  ])
  assert.deepEqual(ready.map((p) => p.brand), ['Blue Delta', null])
  assert.equal(plan.serviceLines, 1)
})

const saleRowsFor = (name: string) => {
  const s = saleFromZapier({ ...INVOICE, CustomerRef: { name } })
  if ('error' in s) throw new Error(s.error)
  return s.rows
}

t('strict matching (webhook): a new first name with a known last name is NOT filed under the relative', () => {
  const sale = saleFromZapier({ ...INVOICE, CustomerRef: { name: 'Missy Bailey' } })
  assert.ok(!('error' in sale))
  const clients: ImportClient[] = [{ id: 'shane', first_name: 'Shane', last_name: 'Bailey' }]
  const loose = planPurchaseImport(sale.rows, clients, [], new Date(), {})
  const strict = planPurchaseImport(sale.rows, clients, [], new Date(), { lastNameFallback: false })
  assert.ok(loose.inserts.length > 0, 'manual import keeps its unique-last-name fallback')
  assert.equal(strict.inserts.length, 0)
  assert.equal(strict.unmatched.length, 3)
  const andrew = planPurchaseImport(saleRowsFor('Andrew S. Cohen'), [{ id: 'a', first_name: 'Andrew', last_name: 'Cohen' }], [], new Date(), { lastNameFallback: false })
  assert.ok(andrew.inserts.length > 0, 'middle initials still match in strict mode')
})

t('explicit shape with Line-item-to-Text fields joined by the separator', () => {
  const j = (...xs: string[]) => xs.join(LINE_SEPARATOR)
  const sale = saleFromZapier({
    customer: 'Ann Lee', date: '10/05/2026', invoice_number: '2602',
    product: j('Wardrobe Styling:Paige Jeans', 'Wardrobe Styling:Socks'),
    description: j('Lennox, 31', ''),
    quantity: j('2', '1'),
    amount: j('450', '30'),
  })
  assert.ok(!('error' in sale))
  assert.deepEqual(sale.rows.map((r) => [r.product, r.description, r.quantity, r.amount]), [
    ['Wardrobe Styling:Paige Jeans', 'Lennox, 31', '2', '450'],
    ['Wardrobe Styling:Socks', null, '1', '30'],
  ])
})

t('explicit lines that do not line up are rejected instead of guessed', () => {
  const r = saleFromZapier({ customer: 'Ann Lee', product: `A${LINE_SEPARATOR}B`, amount: '10' })
  assert.ok('error' in r)
})

t('a sale with no customer is rejected', () => {
  assert.ok('error' in saleFromZapier({ Line: INVOICE.Line }))
})

t('reads a QuickBooks customer', () => {
  const row = customerFromZapier({
    Customer: {
      GivenName: 'Ann', FamilyName: 'Lee', DisplayName: 'Ann Lee', CompanyName: 'Lee Partners',
      PrimaryEmailAddr: { Address: 'ann@example.com' }, Mobile: { FreeFormNumber: '(512) 555-0100' },
      BillAddr: { Line1: '1 Main St', City: 'Austin', CountrySubDivisionCode: 'TX', PostalCode: '78701' },
    },
  })
  assert.deepEqual(row && [row.first_name, row.last_name, row.email, row.phone, row.company, row.billing_city, row.billing_zip],
    ['Ann', 'Lee', 'ann@example.com', '(512) 555-0100', 'Lee Partners', 'Austin', '78701'])
})

t('customer with only a display name still imports; an empty one does not', () => {
  assert.equal(customerFromZapier({ DisplayName: 'Bo Diddley' })?.full_name, 'Bo Diddley')
  assert.equal(customerFromZapier({ Id: '5' }), null)
})

t('Zapier invoice trigger: customer arrives as a whole "Customer" record, not CustomerRef', () => {
  const rest: Record<string, unknown> = { ...INVOICE }
  delete rest.CustomerRef
  const zapier = { ...rest, Customer: { Id: '58', GivenName: 'Shane', FamilyName: 'Bailey', DisplayName: 'Shane Bailey' }, Lines: rest.Line }
  const sale = saleFromZapier(zapier)
  assert.ok(!('error' in sale), JSON.stringify(sale))
  assert.equal(sale.customer, 'Shane Bailey')
  assert.equal(sale.rows.length, 4)
  const noDisplay = saleFromZapier({ ...rest, Customer: { GivenName: 'Shane', FamilyName: 'Bailey' } })
  assert.ok(!('error' in noDisplay) && noDisplay.customer === 'Shane Bailey')
  assert.ok(!('error' in saleFromZapier({ ...rest, Customer__DisplayName: 'Shane Bailey' })))
})

t('line items in an unknown shape fail loudly instead of saving an empty sale', () => {
  const sale = saleFromZapier({ CustomerRef: { name: 'Ann Lee' }, Line: [{ foo: 1, bar: 2 }] })
  assert.ok('error' in sale && /line keys: foo, bar/.test(sale.error))
})

console.log(`zapierQuickbooks: ${passed} passed`)
