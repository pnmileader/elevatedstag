import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import Papa from 'papaparse'
import { isQboGroupedReport, parseQboGroupedSalesReport, matrixToRowObjects, type CellMatrix } from '../import'

// Synthetic minimal fixture mirroring the QBO export format
const SYNTHETIC = `The Elevated Stag,,,,,,,,,
Sales by Customer Detail,,,,,,,,,
"May 11, 2025-May 11, 2026",,,,,,,,,

,Transaction date,Transaction type,Num,Product/Service full name,Description,Quantity,Sales price,Amount,Balance
Aaron Christensen,,,,,,,,,
,04/29/2026,Invoice,2462,Wardrobe Styling:CCP - Custom Coat & Pant,Burgundy Solid,1.00,"1,549.00","1,549.00","1,549.00"
,04/29/2026,Invoice,2462,Wardrobe Styling:CSHT - Custom Shirt,White Solid,1.00,199.00,199.00,"1,748.00"
Total for Aaron Christensen,,,,,,2.00,,"$1,748.00",
Adam Loewy,,,,,,,,,
,11/13/2025,Invoice,2294,Wardrobe Styling:CT - Custom Trouser,,4.00,549.00,"2,196.00","2,196.00"
Total for Adam Loewy,,,,,,4.00,,"$2,196.00",
TOTAL,,,,,,6.00,,"$3,944.00",
`

function csvToMatrix(text: string): CellMatrix {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, header: false })
  return (parsed.data as string[][]).map((row) => row.map((cell) => (cell === '' ? null : cell)))
}

// ===== Test 1: Detection =====
const synthMatrix = csvToMatrix(SYNTHETIC)
assert.equal(isQboGroupedReport(synthMatrix), true, 'should detect synthetic as grouped')
console.log('✓ Detects synthetic grouped report')

const flatMatrix: CellMatrix = [
  ['Customer', 'Email', 'Phone'],
  ['Alice', 'a@x.com', '555-1234'],
]
assert.equal(isQboGroupedReport(flatMatrix), false, 'should NOT detect a flat csv as grouped')
console.log('✓ Does not falsely detect flat CSV as grouped')

// ===== Test 2: Synthetic parse =====
const result = parseQboGroupedSalesReport(synthMatrix)
assert.equal(result.success, true, 'should parse synthetic without error')
if (result.success) {
  assert.equal(result.rows.length, 3, `expected 3 transactions, got ${result.rows.length}`)
  assert.equal(result.rows[0].customer_name, 'Aaron Christensen')
  assert.equal(result.rows[0].product, 'Wardrobe Styling:CCP - Custom Coat & Pant')
  assert.equal(result.rows[0].amount, '1,549.00')
  assert.equal(result.rows[1].customer_name, 'Aaron Christensen')
  assert.equal(result.rows[2].customer_name, 'Adam Loewy')
  assert.equal(result.rows[2].product, 'Wardrobe Styling:CT - Custom Trouser')
  console.log('✓ Synthetic parse produced 3 rows with correct customer propagation')
}

// ===== Test 3: Real-data parse (file is outside the repo) =====
const FIXTURE_PATH = '/Users/emersonsmith/Documents/test-crm-fixtures/sales_by_customer_detail.csv'
if (fs.existsSync(FIXTURE_PATH)) {
  const csvText = fs.readFileSync(FIXTURE_PATH, 'utf8')
  const m = csvToMatrix(csvText)
  assert.equal(isQboGroupedReport(m), true, 'real fixture should detect as grouped')

  const r = parseQboGroupedSalesReport(m)
  assert.equal(r.success, true, `real parse failed: ${r.success ? '' : r.error}`)
  if (r.success) {
    const rows = r.rows
    console.log(`✓ Real fixture parsed: ${rows.length} transactions`)

    // Sanity checks against real data structure:
    const uniqueCustomers = new Set(rows.map((row) => row.customer_name))
    console.log(`  → ${uniqueCustomers.size} unique customers`)
    const withNoCustomer = rows.filter((row) => !row.customer_name)
    assert.equal(withNoCustomer.length, 0, `${withNoCustomer.length} rows have no customer assigned`)
    const withNoDate = rows.filter((row) => !row.date)
    assert.equal(withNoDate.length, 0, `${withNoDate.length} rows have no date`)
    const withNoProduct = rows.filter((row) => !row.product)
    assert.equal(withNoProduct.length, 0, `${withNoProduct.length} rows have no product`)
    console.log('  → all rows have customer + date + product')

    const sample = rows[0]
    console.log(`  → sample row 1: ${sample.customer_name} | ${sample.date} | ${sample.product} | ${sample.amount}`)
  }
} else {
  console.log('(skipping real-fixture parse — file not present)')
}

// ===== Test 4: matrixToRowObjects =====
const flat: CellMatrix = [
  ['Name', 'Email', 'Phone'],
  ['Alice', 'a@x.com', '555-1'],
  ['Bob', null, '555-2'],
  [null, null, null], // blank row should be skipped
]
const objs = matrixToRowObjects(flat)
assert.equal(objs.length, 2)
assert.equal(objs[0].Name, 'Alice')
assert.equal(objs[1].Name, 'Bob')
assert.equal(objs[1].Email, '')
console.log('✓ matrixToRowObjects skips blank rows and preserves field shapes')

console.log('\nAll import.test.ts assertions passed.')
