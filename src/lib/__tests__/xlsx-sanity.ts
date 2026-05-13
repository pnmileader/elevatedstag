// Quick sanity-test that the upstream SheetJS still parses our real fixture
// with the same column count + row count we expect. Run with:
//   npx tsx src/lib/__tests__/xlsx-sanity.ts

import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import assert from 'node:assert/strict'

const FIXTURE = '/Users/emersonsmith/Documents/test-crm-fixtures/Customers.xls'

if (!fs.existsSync(FIXTURE)) {
  console.log('(fixture not present, skipping)')
  process.exit(0)
}

const buf = fs.readFileSync(FIXTURE)
const wb = XLSX.read(buf, { type: 'buffer' })
assert.equal(wb.SheetNames.length >= 1, true, 'at least one sheet')
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: null, header: 1 })

assert.equal(rows.length, 660, `expected 660 rows incl. header, got ${rows.length}`)
const header = rows[0] as string[]
const expectedCols = ['Name', 'Company name', 'Street Address', 'City', 'State', 'Country', 'Zip', 'Phone', 'Email', 'Customer type', 'Attachments', 'Open balance']
for (let i = 0; i < expectedCols.length; i++) {
  assert.equal(header[i], expectedCols[i], `column ${i} should be "${expectedCols[i]}", got "${header[i]}"`)
}
console.log(`✓ Customers.xls parses: ${rows.length} rows × ${header.length} cols, headers match.`)
console.log(`✓ SheetJS version in use: ${XLSX.version ?? '(unknown)'}`)
