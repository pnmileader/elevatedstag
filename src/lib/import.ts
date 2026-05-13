// Helpers for the CSV / Excel import flow.
// QBO "Sales by Customer Detail" reports come grouped by customer with metadata
// header rows — they need flattening before they look like a row-per-transaction table.

export type CellMatrix = Array<Array<string | null>>

export type FlatSalesRow = {
  customer_name: string
  date: string
  transaction_type: string
  num: string
  product: string
  description: string
  quantity: string
  sales_price: string
  amount: string
}

export type GroupedParseResult =
  | { success: true; rows: FlatSalesRow[]; skippedHeaderRows: number }
  | { success: false; error: string }

const EXPECTED_HEADERS = [
  '',                    // col 0 — customer header column, empty in header row
  'Transaction date',
  'Transaction type',
  'Num',
  'Product/Service full name',
  'Description',
  'Quantity',
  'Sales price',
  'Amount',
]

function normalizeCell(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function isQboGroupedReport(matrix: CellMatrix): boolean {
  if (matrix.length === 0) return false

  // Strong signal: row 1 or row 2 contains the exact report title.
  for (let i = 0; i < Math.min(3, matrix.length); i++) {
    const row = matrix[i]
    for (const cell of row) {
      if (cell && /sales\s+by\s+customer\s+detail/i.test(String(cell))) {
        return true
      }
    }
  }

  // Weaker signal: row 0 has col 0 non-empty but cols 1+ empty (metadata pattern).
  const row0 = matrix[0]
  if (row0 && normalizeCell(row0[0]) !== '' && row0.slice(1).every((c) => normalizeCell(c) === '')) {
    return true
  }

  return false
}

/**
 * Convert a QBO "Sales by Customer Detail" grouped report into flat transaction rows.
 * Expected layout:
 *   row 0:   company name (col 0 only)
 *   row 1:   "Sales by Customer Detail" (col 0 only)
 *   row 2:   date range (col 0 only)
 *   row 3:   blank
 *   row 4:   header — col 0 empty, cols 1+ = Transaction date / Type / Num / Product/Service / Description / Quantity / Sales price / Amount / [Balance]
 *   row 5+:  customer-header rows, transaction rows, and "Total for ..." subtotal rows.
 */
export function parseQboGroupedSalesReport(matrix: CellMatrix): GroupedParseResult {
  // Find the header row — it's the row where col 1 reads "Transaction date".
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i]
    if (row && normalizeCell(row[1]).toLowerCase() === 'transaction date') {
      headerRowIdx = i
      break
    }
  }

  if (headerRowIdx < 0) {
    return { success: false, error: 'Could not locate the header row ("Transaction date" in column 2). Is this really a Sales by Customer Detail export?' }
  }

  const header = matrix[headerRowIdx]
  for (let i = 1; i < EXPECTED_HEADERS.length; i++) {
    const got = normalizeCell(header[i]).toLowerCase()
    const want = EXPECTED_HEADERS[i].toLowerCase()
    if (!got || !got.includes(want.split(' ')[0])) {
      return {
        success: false,
        error: `Column ${i + 1} header expected ~"${EXPECTED_HEADERS[i]}" but got "${normalizeCell(header[i])}". Re-export the report with default columns.`,
      }
    }
  }

  const rows: FlatSalesRow[] = []
  let currentCustomer = ''

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row) continue

    const col0 = normalizeCell(row[0])
    const col1 = normalizeCell(row[1]) // Transaction date

    // Blank row → skip
    if (col0 === '' && row.slice(1).every((c) => normalizeCell(c) === '')) continue

    // Subtotal row "Total for X" → skip
    if (/^total\s+for\b/i.test(col0)) continue

    // Grand total at bottom — "TOTAL" in col 0 or any pure totals row → skip
    if (/^total$/i.test(col0)) continue

    // Customer-header row: col 0 has a value, col 1 (date) empty, not a "Total for" row
    if (col0 !== '' && col1 === '') {
      currentCustomer = col0
      continue
    }

    // Transaction row: col 0 empty, col 1 (date) populated
    if (col0 === '' && col1 !== '') {
      rows.push({
        customer_name: currentCustomer,
        date: col1,
        transaction_type: normalizeCell(row[2]),
        num: normalizeCell(row[3]),
        product: normalizeCell(row[4]),
        description: normalizeCell(row[5]),
        quantity: normalizeCell(row[6]),
        sales_price: normalizeCell(row[7]),
        amount: normalizeCell(row[8]),
      })
      continue
    }

    // Anything else (mixed shape) → skip but keep going
  }

  return { success: true, rows, skippedHeaderRows: headerRowIdx + 1 }
}

/**
 * Convert a 2-D matrix (after parsing) into a flat array of row objects keyed by header.
 * Used by the flat-CSV path so both CSV and Excel paths land on the same shape before mapping.
 */
export function matrixToRowObjects(matrix: CellMatrix): Array<Record<string, string>> {
  if (matrix.length < 2) return []
  const headers = matrix[0].map((h) => normalizeCell(h))
  const out: Array<Record<string, string>> = []
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i]
    const obj: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = normalizeCell(row[c])
    }
    if (Object.values(obj).some((v) => v !== '')) out.push(obj)
  }
  return out
}
