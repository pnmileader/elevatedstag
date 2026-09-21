// Dev check: every client's CRM wardrobe total should equal the QuickBooks report.
// Usage: npx tsx scripts/verify-import.mts /path/to/sales_by_customer_detail.csv
import * as fs from 'node:fs'
import Papa from 'papaparse'
import { parseQboGroupedSalesReport, type CellMatrix } from '../src/lib/import'
import { parseInvoiceLineItem } from '../src/lib/quickbooks'
import { parseNumber, splitCustomerName } from '../src/lib/purchaseImport'
import { getDb } from './db.mjs'

const file = process.argv[2]
const parsed = Papa.parse<string[]>(fs.readFileSync(file, 'utf8'), { skipEmptyLines: false, header: false })
const matrix: CellMatrix = (parsed.data as string[][]).map((r) => r.map((c) => (c === '' ? null : c)))
const report = parseQboGroupedSalesReport(matrix)
if (!report.success) throw new Error(report.error)

const expected = new Map<string, number>()
for (const r of report.rows) {
  const cat = parseInvoiceLineItem(r.product, r.description).category
  const amount = parseNumber(r.amount) || 0
  if ((cat !== 'custom' && cat !== 'ready_made') || amount < 0) continue
  expected.set(r.customer_name, (expected.get(r.customer_name) || 0) + amount)
}

const db = await getDb()
const all = async (t: string, cols: string) => {
  const out: Record<string, unknown>[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from(t).select(cols).order('id').range(f, f + 999)
    if (error) throw new Error(error.message)
    const page = (data || []) as unknown as Record<string, unknown>[]
    out.push(...page)
    if (page.length < 1000) break
  }
  return out
}
const clients = await all('clients', 'id, first_name, last_name')
const orders = await all('custom_orders', 'id, client_id, price')
const ready = await all('ready_made_purchases', 'id, client_id, price, quantity')
const totals = new Map<string, number>()
for (const o of orders) totals.set(o.client_id as string, (totals.get(o.client_id as string) || 0) + Number(o.price || 0))
for (const p of ready) totals.set(p.client_id as string, (totals.get(p.client_id as string) || 0) + Number(p.price || 0) * (Number(p.quantity) || 1))

let ok = 0; const off: string[] = []
for (const [name, want] of expected) {
  const { first, last } = splitCustomerName(name)
  const c = clients.find((x) => String(x.first_name || '').toLowerCase() === first.toLowerCase() && String(x.last_name || '').toLowerCase() === last.toLowerCase())
  const got = c ? totals.get(c.id as string) || 0 : NaN
  if (Math.abs(got - want) < 0.05 * Math.max(1, want / 1000)) ok++
  else off.push(`${name}: report $${want.toFixed(2)} vs CRM $${Number.isNaN(got) ? 'no client' : got.toFixed(2)}`)
}
console.log(`custom_orders=${orders.length} ready_made=${ready.length}`)
console.log(`clients matching the report to the cent: ${ok}/${expected.size}`)
off.slice(0, 15).forEach((l) => console.log('  MISMATCH', l))
for (const who of ['Shane Bailey', 'David Kline', 'James Bettersworth']) {
  const { first, last } = splitCustomerName(who)
  const c = clients.find((x) => x.first_name === first && x.last_name === last)
  console.log(`${who}: report $${(expected.get(who) || 0).toFixed(2)} | CRM $${(totals.get(c?.id as string) || 0).toFixed(2)}`)
}
