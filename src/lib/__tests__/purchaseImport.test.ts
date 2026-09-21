// Run with: npx tsx src/lib/__tests__/purchaseImport.test.ts
// Uses the real QBO export when present (kept outside the repo — it has client PII).
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import Papa from 'papaparse'
import { parseQboGroupedSalesReport, type CellMatrix } from '../import'
import {
  planPurchaseImport, unitPrice,
  type ExistingPurchaseRow, type ImportClient, type IncomingPurchaseRow, type ImportPlan,
} from '../purchaseImport'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const TODAY = new Date('2026-09-20T12:00:00Z')

const SHANE = `The Elevated Stag,,,,,,,,,
Sales by Customer Detail,,,,,,,,,
"May 11, 2025-May 11, 2026",,,,,,,,,

,Transaction date,Transaction type,Num,Product/Service full name,Description,Quantity,Sales price,Amount,Balance
Shane Bailey,,,,,,,,,
,06/06/2025,Invoice,2166,Wardrobe Styling:Blue Delta Jeans,Vintage Denim: Grey & Dk Olive,2.00,500.00,"1,000.00","1,000.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:Blue Delta Jeans,"Chino: Dk. Blue, Burgundy, Black",3.00,500.00,"1,500.00","2,500.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:CSHT - Custom Shirt,White twill,2.00,249.00,498.00,"2,998.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:CSHT - Custom Shirt,Blue twill,1.00,249.00,249.00,"3,247.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:CSHT - Custom Shirt,Blue dobby square,1.00,249.00,249.00,"3,496.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:CSHT - Custom Shirt,Pink square,1.00,249.00,249.00,"3,745.00"
,06/06/2025,Invoice,2166,Wardrobe Styling:CSC - Custom Sport Coat,Green + Blue Plaid,1.00,"2,449.00","2,449.00","6,194.00"
,06/18/2025,Invoice,2183,Wardrobe Styling:Alterations,Jacket: Let out Half Girth,7.00,173.20,"1,212.40","7,406.40"
Total for Shane Bailey,,,,,,18.00,,"$7,406.40",
David Kline,,,,,,,,,
,05/07/2026,Invoice,2474,Wardrobe Styling:Paige Jeans,"Jeans (Ink Cellar, Charcoal, Light Grey) - 31 Lennox",3.00,225.00,675.00,675.00
Total for David Kline,,,,,,3.00,,$675.00,
TOTAL,,,,,,21.00,,"$8,081.40",
`

function toRows(csv: string): IncomingPurchaseRow[] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false, header: false })
  const matrix: CellMatrix = (parsed.data as string[][]).map((r) => r.map((c) => (c === '' ? null : c)))
  const res = parseQboGroupedSalesReport(matrix)
  assert.ok(res.success, 'fixture should parse')
  return res.rows.map((r) => ({ customer: r.customer_name, date: r.date, invoice_id: r.num, product: r.product, description: r.description, quantity: r.quantity, amount: r.amount }))
}

const clients: ImportClient[] = [
  { id: 'shane', first_name: 'Shane', last_name: 'Bailey' },
  { id: 'kline', first_name: 'David', last_name: 'Kline' },
]

/** Pretend the plan was written to the database, so we can re-plan against it. */
function apply(existing: ExistingPurchaseRow[], plan: ImportPlan): ExistingPurchaseRow[] {
  const next = existing.map((e) => ({ ...e }))
  for (const u of plan.updates) Object.assign(next.find((e) => e.id === u.id)!, u.patch)
  plan.inserts.forEach((ins, i) => {
    const p = ins.payload
    next.push(ins.kind === 'custom'
      ? { id: `new-${next.length}-${i}`, kind: 'custom', client_id: String(p.client_id), invoice_id: p.quickbooks_invoice_id as string, date: p.order_date as string, product: String(p.garment_type), description: String(p.fabric_name || ''), price: p.price as number, quantity: null }
      : { id: `new-${next.length}-${i}`, kind: 'ready_made', client_id: String(p.client_id), invoice_id: p.quickbooks_invoice_id as string, date: p.purchase_date as string, product: String(p.product_name), description: String(p.description || ''), price: p.price as number, quantity: p.quantity as number })
  })
  return next
}
const total = (rows: ExistingPurchaseRow[], clientId: string) =>
  rows.filter((r) => r.client_id === clientId).reduce((s, r) => s + (r.price || 0) * (r.kind === 'ready_made' ? r.quantity || 1 : 1), 0)

const rows = toRows(SHANE)

t('unitPrice = Amount / Qty', () => {
  assert.equal(unitPrice(675, 3), 225)
  assert.equal(unitPrice(498, 2), 249)
  assert.equal(unitPrice(100, 3), 33.33)
  assert.equal(unitPrice(null, 2), null)
})

t('2.3 every line on invoice 2166 is imported (was 3 of 8 lines)', () => {
  const plan = planPurchaseImport(rows, clients, [], TODAY)
  const shane = plan.inserts.filter((i) => i.payload.client_id === 'shane')
  const shirts = shane.filter((i) => i.payload.garment_type === 'Custom Shirt')
  assert.equal(shirts.length, 5, 'white twill x2 + 3 other fabrics')
  assert.deepEqual([...new Set(shirts.map((s) => s.payload.fabric_name))].sort(), ['Blue dobby square', 'Blue twill', 'Pink square', 'White twill'])
  assert.equal(shane.filter((i) => i.payload.garment_type === 'Sport Coat').length, 1)
  assert.equal(shane.filter((i) => i.kind === 'ready_made').length, 2, 'both Blue Delta lines')
  assert.equal(plan.serviceLines, 1, 'alterations stay out of the wardrobe history')
})

t('2.2 price is per item; quantity is kept', () => {
  const plan = planPurchaseImport(rows, clients, [], TODAY)
  const jeans = plan.inserts.find((i) => i.payload.client_id === 'kline')!
  assert.equal(jeans.payload.price, 225)
  assert.equal(jeans.payload.quantity, 3)
  const whiteTwill = plan.inserts.filter((i) => i.payload.fabric_name === 'White twill')
  assert.deepEqual(whiteTwill.map((w) => w.payload.price), [249, 249], '$498 line of 2 shirts -> two $249 shirts')
})

t('invoice total is preserved exactly', () => {
  const db = apply([], planPurchaseImport(rows, clients, [], TODAY))
  assert.equal(total(db, 'shane'), 6194) // 7,406.40 minus the 1,212.40 alterations service line
  assert.equal(total(db, 'kline'), 675)
})

t('historical orders import as delivered, recent ones as ordered', () => {
  const plan = planPurchaseImport(rows, clients, [], TODAY)
  assert.ok(plan.inserts.filter((i) => i.kind === 'custom').every((i) => i.payload.status === 'delivered'))
  const recent = planPurchaseImport([{ customer: 'Shane Bailey', date: '09/10/2026', invoice_id: '3000', product: 'Wardrobe Styling:CSHT - Custom Shirt', description: 'New', quantity: 1, amount: 249 }], clients, [], TODAY)
  assert.equal(recent.inserts[0].payload.status, 'ordered')
})

t('re-importing the same file changes nothing (no duplicates)', () => {
  const db = apply([], planPurchaseImport(rows, clients, [], TODAY))
  const again = planPurchaseImport(rows, clients, db, TODAY)
  assert.equal(again.inserts.length, 0)
  assert.equal(again.updates.length, 0)
  assert.equal(again.unchanged, db.length)
})

t('repairs what the OLD importer left behind: collapsed lines + line-total prices', () => {
  // Exactly what production held for these two clients before this fix.
  const legacy: ExistingPurchaseRow[] = [
    { id: 'L1', kind: 'ready_made', client_id: 'shane', invoice_id: '2166', date: '2025-06-06', product: 'Wardrobe Styling:Blue Delta Jeans', description: 'Vintage Denim: Grey & Dk Olive', price: 1000, quantity: 2 },
    { id: 'L2', kind: 'custom', client_id: 'shane', invoice_id: '2166', date: '2025-06-06', product: 'Custom Shirt', description: 'White twill', price: 498, quantity: null },
    { id: 'L3', kind: 'custom', client_id: 'shane', invoice_id: '2166', date: '2025-06-06', product: 'Sport Coat', description: 'Green + Blue Plaid', price: 2449, quantity: null },
    { id: 'L4', kind: 'ready_made', client_id: 'kline', invoice_id: '2474', date: '2026-05-07', product: 'Wardrobe Styling:Paige Jeans', description: 'Jeans (Ink Cellar, Charcoal, Light Grey) - 31 Lennox', price: 675, quantity: 3 },
  ]
  const plan = planPurchaseImport(rows, clients, legacy, TODAY)
  assert.deepEqual(plan.updates.map((u) => [u.id, u.patch.price]).sort(), [['L1', 500], ['L2', 249], ['L4', 225]])
  assert.equal(plan.inserts.length, 5, '1 more white twill + 3 fabrics + chinos')
  const db = apply(legacy, plan)
  assert.equal(total(db, 'shane'), 6194)
  assert.equal(total(db, 'kline'), 675)
  assert.equal(planPurchaseImport(rows, clients, db, TODAY).inserts.length, 0, 'and it is stable afterwards')
})

t('same product + description at two prices on one invoice stays stable across re-imports', () => {
  const twoPrices: IncomingPurchaseRow[] = [
    { customer: 'Shane Bailey', date: '01/05/2026', invoice_id: '2400', product: 'Wardrobe Styling:CSHT - Custom Shirt', description: 'White', quantity: 1, amount: 249 },
    { customer: 'Shane Bailey', date: '01/05/2026', invoice_id: '2400', product: 'Wardrobe Styling:CSHT - Custom Shirt', description: 'White', quantity: 1, amount: 199 },
  ]
  let db = apply([], planPurchaseImport(twoPrices, clients, [], TODAY))
  db = [...db].reverse() // the database returns rows in arbitrary (uuid) order
  const again = planPurchaseImport(twoPrices, clients, db, TODAY)
  assert.equal(again.updates.length, 0)
  assert.equal(again.inserts.length, 0)
})

const REAL = '/Users/emersonsmith/Documents/test-crm-fixtures/sales_by_customer_detail.csv'
if (fs.existsSync(REAL)) {
  t('real 12-month export: nothing is dropped as a "duplicate" any more', () => {
    const real = toRows(fs.readFileSync(REAL, 'utf8'))
    const names = [...new Set(real.map((r) => String(r.customer)))]
    const everyone: ImportClient[] = names.map((n, i) => { const [first, ...rest] = n.split(/\s+/); return { id: `c${i}`, first_name: first, last_name: rest.join(' ') } })
    const plan = planPurchaseImport(real, everyone, [], TODAY)
    const wardrobeLines = real.length - plan.skipped
    const custom = plan.inserts.filter((i) => i.kind === 'custom').length
    const ready = plan.inserts.filter((i) => i.kind === 'ready_made').length
    console.log(`        ${real.length} report lines -> ${custom} custom garments + ${ready} ready-made rows (old importer kept 361 + 178); ${plan.needsReview.length} need review, ${plan.unmatched.length} unmatched`)
    assert.ok(custom > 361 && ready > 178)
    assert.ok(custom + ready >= wardrobeLines)
  })
}
console.log(`purchaseImport: ${passed} passed`)
