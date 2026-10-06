'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react'
import Layout from '@/components/Layout'
import ConfirmModal from '@/components/ConfirmModal'
import { distinctUnmatchedNames } from '@/lib/purchaseImport'
import {
  isQboGroupedReport,
  parseQboGroupedSalesReport,
  matrixToRowObjects,
  type CellMatrix,
  type FlatSalesRow,
} from '@/lib/import'

const CLIENT_FIELDS = [
  { key: '', label: '— skip —' },
  { key: 'full_name', label: 'Full Name (split into first + last on import)' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'billing_street', label: 'Billing Street' },
  { key: 'billing_city', label: 'Billing City' },
  { key: 'billing_state', label: 'Billing State' },
  { key: 'billing_zip', label: 'Billing Zip' },
  { key: 'shipping_street', label: 'Shipping Street' },
  { key: 'shipping_city', label: 'Shipping City' },
  { key: 'shipping_state', label: 'Shipping State' },
  { key: 'shipping_zip', label: 'Shipping Zip' },
  { key: 'customer_type', label: 'Customer Type → location tag' },
  { key: 'notes', label: 'Notes' },
] as const

const PURCHASE_FIELDS = [
  { key: '', label: '— skip —' },
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Date' },
  { key: 'product', label: 'Product / Service' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'amount', label: 'Amount' },
  { key: 'invoice_id', label: 'Invoice #' },
  { key: 'line_id', label: 'Line ID' },
] as const

function guessClientField(header: string): string {
  const h = header.toLowerCase().trim()
  if (h === 'name' || h === 'customer' || h === 'client' || /full\s*name/.test(h) || /display\s*name/.test(h)) {
    return 'full_name'
  }
  if (/^first|given/.test(h)) return 'first_name'
  if (/^last|family|surname/.test(h)) return 'last_name'
  if (/e[-\s]?mail/.test(h)) return 'email'
  if (/phone|mobile|cell/.test(h)) return 'phone'
  if (/company|business/.test(h)) return 'company'
  if (/customer\s*type/.test(h)) return 'customer_type'
  if (/bill.*(street|addr.*line.*1|line\s*1|address)/.test(h)) return 'billing_street'
  if (/bill.*city/.test(h)) return 'billing_city'
  if (/bill.*(state|province|country.*sub)/.test(h)) return 'billing_state'
  if (/bill.*(zip|postal)/.test(h)) return 'billing_zip'
  if (/ship.*(street|addr.*line.*1|line\s*1|address)/.test(h)) return 'shipping_street'
  if (/ship.*city/.test(h)) return 'shipping_city'
  if (/ship.*(state|province|country.*sub)/.test(h)) return 'shipping_state'
  if (/ship.*(zip|postal)/.test(h)) return 'shipping_zip'
  if (h === 'address' || h === 'street') return 'billing_street'
  if (h === 'city') return 'billing_city'
  if (h === 'state' || h === 'province') return 'billing_state'
  if (h === 'zip' || h === 'postal code') return 'billing_zip'
  if (/note|memo/.test(h)) return 'notes'
  return ''
}

function guessPurchaseField(header: string): string {
  const h = header.toLowerCase().trim()
  if (/^(customer|client|name)$/.test(h) || /customer\s*name/.test(h)) return 'customer'
  if (/^date|txn.?date|transaction/.test(h)) return 'date'
  if (/product|item|service/.test(h)) return 'product'
  if (/description|memo/.test(h)) return 'description'
  if (/^qty|quantity/.test(h)) return 'quantity'
  if (/amount|total|price/.test(h)) return 'amount'
  if (/invoice/.test(h)) return 'invoice_id'
  if (/^line/.test(h) || /line\s*id/.test(h)) return 'line_id'
  return ''
}

type Mode = 'clients' | 'purchases'

type ParsedFile = {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
  fileKind: 'csv' | 'xls'
  groupedReport?: { rows: FlatSalesRow[]; skippedHeaderRows: number }
}

type ClientsResult = {
  success: boolean
  imported: number
  updated: number
  skipped: number
  total: number
  errors: Array<{ row: number; error: string }>
} | { error: string }

type PurchasesResult = {
  success: boolean
  customCreated: number
  readyMadeCreated: number
  updated?: number
  unchanged?: number
  skipped: number
  deduped: number
  serviceLines: number
  discountLines: number
  outOfScopeLines?: number
  refundLines?: number
  insertErrors?: number
  total: number
  unmatched: Array<{ row: number; customer: string }>
  needsReview: Array<{ row: number; customer: string; product: string; description: string }>
  errors: Array<{ row: number; error: string }>
  errorsTruncated?: number
} | { error: string }

// A full-history report can be thousands of lines — too much for one request.
// Send it in batches, always cutting BETWEEN customers so every line of an
// invoice is planned together, then add the results up.
const PURCHASE_BATCH_ROWS = 400

function batchByCustomer(rows: Array<Record<string, string>>): Array<Array<Record<string, string>>> {
  const batches: Array<Array<Record<string, string>>> = []
  let current: Array<Record<string, string>> = []
  let lastCustomer: string | undefined
  for (const row of rows) {
    if (current.length >= PURCHASE_BATCH_ROWS && row.customer !== lastCustomer) {
      batches.push(current)
      current = []
    }
    current.push(row)
    lastCustomer = row.customer
  }
  if (current.length) batches.push(current)
  return batches
}

async function importPurchasesInBatches(apiPath: string, rows: Array<Record<string, string>>): Promise<PurchasesResult> {
  const total: Exclude<PurchasesResult, { error: string }> = {
    success: true, customCreated: 0, readyMadeCreated: 0, updated: 0, unchanged: 0, skipped: 0, deduped: 0,
    serviceLines: 0, discountLines: 0, outOfScopeLines: 0, refundLines: 0, insertErrors: 0, total: 0,
    unmatched: [], needsReview: [], errors: [], errorsTruncated: 0,
  }
  let offset = 0
  for (const batch of batchByCustomer(rows)) {
    const response = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batch }),
    })
    const data = (await response.json()) as PurchasesResult
    if ('error' in data) {
      return { error: `${data.error} (after ${offset} of ${rows.length} lines — it is safe to run the import again)` }
    }
    total.customCreated += data.customCreated
    total.readyMadeCreated += data.readyMadeCreated
    total.updated = (total.updated || 0) + (data.updated || 0)
    total.unchanged = (total.unchanged || 0) + (data.unchanged || 0)
    total.deduped += data.deduped
    total.skipped += data.skipped
    total.serviceLines += data.serviceLines
    total.discountLines += data.discountLines
    total.outOfScopeLines = (total.outOfScopeLines || 0) + (data.outOfScopeLines || 0)
    total.refundLines = (total.refundLines || 0) + (data.refundLines || 0)
    total.insertErrors = (total.insertErrors || 0) + (data.insertErrors || 0)
    total.total += data.total
    // Row numbers come back relative to the batch — shift them to file positions.
    total.unmatched.push(...data.unmatched.map((u) => ({ ...u, row: u.row + offset })))
    total.needsReview.push(...data.needsReview.map((n) => ({ ...n, row: n.row + offset })))
    total.errors.push(...data.errors.map((e) => ({ ...e, row: e.row ? e.row + offset : 0 })))
    total.errorsTruncated = (total.errorsTruncated || 0) + (data.errorsTruncated || 0)
    offset += batch.length
  }
  return total
}


// A flattened Sales by Customer Detail report always has these columns, already
// mapped — whichever zone it was dropped into.
const GROUPED_HEADERS = ['customer_name', 'date', 'transaction_type', 'num', 'product', 'description', 'quantity', 'sales_price', 'amount']
const GROUPED_MAPPING: Record<string, string> = {
  customer_name: 'customer',
  date: 'date',
  transaction_type: '',
  num: 'invoice_id',
  product: 'product',
  description: 'description',
  quantity: 'quantity',
  sales_price: '',
  amount: 'amount',
}

function groupedReportToParsedFile(
  report: { rows: FlatSalesRow[]; skippedHeaderRows: number },
  fileName: string,
  fileKind: 'csv' | 'xls',
): ParsedFile {
  const rows = report.rows.map((r) => ({
    customer_name: r.customer_name,
    date: r.date,
    transaction_type: r.transaction_type,
    num: r.num,
    product: r.product,
    description: r.description,
    quantity: r.quantity,
    sales_price: r.sales_price,
    amount: r.amount,
  }))
  return { headers: GROUPED_HEADERS, rows, fileName, fileKind, groupedReport: report }
}

type CreateClientsResult = { success: true; created: number; alreadyMatched: number; errors: Array<{ name: string; error: string }> } | { error: string }

function extensionOf(fileName: string): 'csv' | 'xls' | 'xlsx' | 'unknown' {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx')) return 'xlsx'
  if (lower.endsWith('.xls')) return 'xls'
  return 'unknown'
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function xlsxToMatrix(buffer: ArrayBuffer): CellMatrix {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: null, header: 1, blankrows: false, raw: false })
  return rows.map((row) => row.map((cell) => (cell == null ? null : String(cell))))
}

function csvToMatrix(text: string): CellMatrix {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, header: false })
  return (parsed.data as string[][]).map((row) => row.map((cell) => (cell === '' || cell == null ? null : cell)))
}

function UploadZone({
  mode,
  parsed,
  setParsed,
  onMoveToPurchases,
}: {
  mode: Mode
  parsed: ParsedFile | null
  setParsed: (p: ParsedFile | null) => void
  /** Clients zone only: hand a dropped Sales by Customer Detail report to the purchases zone. */
  onMoveToPurchases?: (p: ParsedFile) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ClientsResult | PurchasesResult | null>(null)
  // Purchases: the rows last sent, so "Create N clients and re-import" can re-run them.
  const [lastRows, setLastRows] = useState<Array<Record<string, string>> | null>(null)
  const [creatingClients, setCreatingClients] = useState(false)
  const [createNote, setCreateNote] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fields = mode === 'clients' ? CLIENT_FIELDS : PURCHASE_FIELDS
  const apiPath = mode === 'clients' ? '/api/import/clients' : '/api/import/purchases'
  const title = mode === 'clients' ? 'Import Clients' : 'Import Purchase History'
  const subtitle =
    mode === 'clients'
      ? 'Upload the QBO Customers export (CSV or Excel).'
      : 'Upload the QBO "Sales by Customer Detail" report (CSV). Set the report period to "All Dates" to bring in full history — the CRM only knows about the dates the report covers. Re-importing is safe: existing items are matched and corrected, never duplicated.'

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null)
      setResult(null)
      setCreateNote(null)

      const ext = extensionOf(file.name)
      if (ext === 'unknown') {
        setParseError('Please upload a .csv, .xls, or .xlsx file.')
        return
      }

      try {
        // Read the file into a 2-D matrix first — same shape for both CSV and Excel.
        let matrix: CellMatrix
        let fileKind: 'csv' | 'xls'
        if (ext === 'csv') {
          const text = await readFileAsText(file)
          matrix = csvToMatrix(text)
          fileKind = 'csv'
        } else {
          const buffer = await readFileAsArrayBuffer(file)
          matrix = xlsxToMatrix(buffer)
          fileKind = 'xls'
        }

        // For purchases: detect QBO grouped sales report and flatten if so.
        if (mode === 'purchases' && isQboGroupedReport(matrix)) {
          const result = parseQboGroupedSalesReport(matrix)
          if (!result.success) {
            setParseError(result.error)
            return
          }
          // Pre-set the mapping so the user doesn't have to do it.
          setMapping(GROUPED_MAPPING)
          setParsed(groupedReportToParsedFile(result, file.name, fileKind))
          return
        }

        // Clients: the sales report dropped in the wrong zone. Keep the parsed
        // report so the notice can hand it straight to Purchase History.
        if (mode === 'clients' && isQboGroupedReport(matrix)) {
          const report = parseQboGroupedSalesReport(matrix)
          if (report.success) {
            setMapping({})
            setParsed(groupedReportToParsedFile(report, file.name, fileKind))
            return
          }
        }

        // Flat table path — first row is headers.
        const rowObjects = matrixToRowObjects(matrix)
        if (rowObjects.length === 0) {
          setParseError('No data rows found in the file.')
          return
        }
        const headers = matrix[0].map((h) => (h ?? '').toString().trim()).filter((h) => h !== '')
        const guesser = mode === 'clients' ? guessClientField : guessPurchaseField
        const initialMapping: Record<string, string> = {}
        for (const h of headers) initialMapping[h] = guesser(h)
        setMapping(initialMapping)
        setParsed({ headers, rows: rowObjects, fileName: file.name, fileKind })
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to read file')
      }
    },
    [mode, setParsed],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const preview = useMemo(() => parsed?.rows.slice(0, 5) ?? [], [parsed])

  const isGroupedReport = !!parsed?.groupedReport
  // The sales report in the Clients zone: show the "belongs in Purchase History" notice instead.
  const isMisplacedSalesReport = mode === 'clients' && isGroupedReport
  // A grouped report's mapping is fixed — also when it was handed over from the Clients zone.
  const effectiveMapping = isGroupedReport ? GROUPED_MAPPING : mapping
  // e.g. a report with a title row on top: the "header row" is one cell like "The Elevated Stag".
  const singleHeader = !!parsed && !isGroupedReport && parsed.headers.length === 1 ? parsed.headers[0] : null

  const requiredMissing = useMemo(() => {
    if (!parsed) return []
    const mapped = new Set(Object.values(effectiveMapping).filter(Boolean))
    const missing: string[] = []
    if (mode === 'clients') {
      const hasName = mapped.has('full_name') || mapped.has('first_name') || mapped.has('last_name')
      const hasContact = mapped.has('email') || mapped.has('phone')
      if (!hasName) missing.push('full name (or first/last)')
      if (!hasContact) missing.push('email or phone')
    } else {
      if (!mapped.has('customer')) missing.push('customer')
      if (!mapped.has('product')) missing.push('product')
    }
    return missing
  }, [effectiveMapping, mode, parsed])

  async function handleSubmit() {
    if (!parsed) return
    setSubmitting(true)
    setResult(null)
    setCreateNote(null)
    try {
      const transformed = parsed.rows.map((raw) => {
        const out: Record<string, string> = {}
        for (const header of parsed.headers) {
          const field = effectiveMapping[header]
          if (field && raw[header] !== undefined) out[field] = raw[header]
        }
        return out
      })
      if (mode === 'purchases') {
        setLastRows(transformed)
        setResult(await importPurchasesInBatches(apiPath, transformed))
        return
      }
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: transformed }),
      })
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setSubmitting(false)
    }
  }

  // Purchases: create name-only clients for the unmatched customers, then run the
  // same rows again so their purchases land.
  async function createMissingAndReimport(names: string[]) {
    if (!lastRows || names.length === 0) return
    setCreatingClients(true)
    setCreateNote(null)
    try {
      const response = await fetch('/api/import/missing-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      })
      const data = (await response.json()) as CreateClientsResult
      if ('error' in data) {
        setCreateNote({ ok: false, text: `Could not create the clients: ${data.error}` })
        return
      }
      const failed = data.errors.length
      const parts = [`Created ${data.created} client${data.created === 1 ? '' : 's'} and re-ran the import.`]
      if (data.alreadyMatched > 0) parts.push(`${data.alreadyMatched} name${data.alreadyMatched === 1 ? '' : 's'} already matched a client.`)
      if (failed > 0) parts.push(`${failed} could not be created (${data.errors.slice(0, 3).map((e) => e.name).join(', ')}${failed > 3 ? '…' : ''}).`)
      setCreateNote({ ok: failed === 0, text: parts.join(' ') })
      setResult(await importPurchasesInBatches(apiPath, lastRows))
    } catch (err) {
      setCreateNote({ ok: false, text: err instanceof Error ? err.message : 'Could not create the clients' })
    } finally {
      setCreatingClients(false)
    }
  }

  function reset() {
    setParsed(null)
    setMapping({})
    setResult(null)
    setParseError(null)
    setLastRows(null)
    setCreateNote(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-white rounded p-4 border border-gray-med" data-testid={`import-zone-${mode}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="font-heading text-base font-medium text-body">{title}</h2>
          <p className="font-body text-sm text-gray-dark">{subtitle}</p>
        </div>
        {parsed && (
          <button
            onClick={reset}
            className="text-gray-dark hover:text-body text-sm flex items-center gap-1"
            aria-label="Clear file"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {!parsed && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-body bg-gray-light' : 'border-gray-med hover:border-body'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-dark" />
          <p className="font-body text-sm text-body font-medium mb-1">
            Drop your file here, or click to browse
          </p>
          <p className="font-body text-xs text-gray-dark">.csv, .xls, or .xlsx</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>
      )}

      {parseError && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded font-body text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" /> {parseError}
        </div>
      )}

      {parsed && !result && isMisplacedSalesReport && (
        <div
          className="mt-3 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded font-body text-sm space-y-3"
          role="status"
          data-testid="sales-report-notice"
        >
          <div className="flex items-center gap-2 text-gray-dark">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-body">{parsed.fileName}</span>
            <span>·</span>
            <span>{parsed.rows.length} sales lines</span>
          </div>
          <p className="font-medium">This is the QuickBooks &ldquo;Sales by Customer Detail&rdquo; report.</p>
          <p>
            That report is your purchase history, so it belongs in <span className="font-medium">Import Purchase History</span> below.
            This box is for the Customers list (Sales → Customers → ⚙ → Export to Excel).
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onMoveToPurchases?.(parsed)}
              className="es-btn es-btn-primary h-[44px]"
              data-testid="move-to-purchases"
            >
              Move it to Purchase History
            </button>
            <button type="button" onClick={reset} className="es-btn es-btn-secondary h-[44px]">
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {parsed && !result && !isMisplacedSalesReport && (
        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-2 text-sm font-body text-gray-dark">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-body">{parsed.fileName}</span>
            <span>·</span>
            <span>{parsed.rows.length} rows</span>
            {parsed.fileKind === 'xls' && (
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-light rounded text-xs">
                Excel
              </span>
            )}
            {isGroupedReport && (
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                <Sparkles className="w-3 h-3" /> QBO grouped report (auto-flattened)
              </span>
            )}
          </div>

          {isGroupedReport && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 rounded font-body text-sm">
              The customer name has been propagated to each transaction row below.
              Columns are auto-mapped, so you can skip the mapping step.
            </div>
          )}

          {!isGroupedReport && (
            <div>
              <h3 className="font-heading text-sm font-medium text-body mb-2">Column mapping</h3>
              <div className="space-y-2">
                {parsed.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <div className="flex-1 font-body text-sm text-body truncate" title={header}>
                      {header}
                    </div>
                    <div className="text-gray-dark">→</div>
                    <select
                      value={mapping[header] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                      className="flex-1 border border-gray-med rounded px-2 py-1 font-body text-sm bg-white"
                    >
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-heading text-sm font-medium text-body mb-2">
              Preview (first 5 rows)
            </h3>
            <div className="overflow-x-auto border border-gray-med rounded">
              <table className="w-full text-xs font-body">
                <thead className="bg-gray-light">
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left text-body font-medium border-b border-gray-med">
                        {h}
                        {!isGroupedReport && mapping[h] && (
                          <div className="text-gray-dark text-xs font-normal">
                            → {fields.find((f) => f.key === mapping[h])?.label}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-med last:border-0">
                      {parsed.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-gray-dark whitespace-nowrap max-w-[14rem] truncate" title={row[h]}>
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {singleHeader !== null && (
            <div
              className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded font-body text-sm space-y-1"
              data-testid="single-header-notice"
            >
              <p className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Only one column heading was found: &ldquo;{singleHeader}&rdquo;.
              </p>
              <p>
                The first row of the file needs to be the column headings
                {mode === 'clients' ? ' (Name, Email, Phone…)' : ' (Customer, Date, Product…)'}.
                If the file starts with a title such as your company name, it is probably a QuickBooks report rather than a list.
                {mode === 'clients'
                  ? ' For clients, export the Customers list: Sales → Customers → ⚙ → Export to Excel.'
                  : ' For purchases, export Reports → Sales by Customer Detail → Export to CSV.'}
              </p>
            </div>
          )}

          {requiredMissing.length > 0 && !isGroupedReport && singleHeader === null && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded font-body text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Map at least: {requiredMissing.join(', ')}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || (requiredMissing.length > 0 && !isGroupedReport)}
              className="bg-body hover:bg-body-hover disabled:bg-gray-med text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing {parsed.rows.length} rows…
                </>
              ) : (
                <>Confirm Import ({parsed.rows.length} rows)</>
              )}
            </button>
            <button
              onClick={reset}
              disabled={submitting}
              className="border border-gray-med hover:border-body text-gray-dark px-4 py-2 rounded font-body text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {createNote && (
        <div
          className={`mt-3 px-3 py-2 rounded font-body text-sm border ${createNote.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}
          role="status"
          data-testid="create-clients-note"
        >
          {createNote.text}
        </div>
      )}

      {result && 'error' in result && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded font-body text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {result.error}
        </div>
      )}

      {result && !('error' in result) && mode === 'clients' && (
        <ClientsSummary result={result as Exclude<ClientsResult, { error: string }>} onReset={reset} />
      )}

      {result && !('error' in result) && mode === 'purchases' && (
        <PurchasesSummary
          result={result as Exclude<PurchasesResult, { error: string }>}
          onReset={reset}
          canCreateClients={!!lastRows}
          creatingClients={creatingClients}
          onCreateClients={createMissingAndReimport}
        />
      )}
    </div>
  )
}

function ClientsSummary({
  result,
  onReset,
}: {
  result: Exclude<ClientsResult, { error: string }>
  onReset: () => void
}) {
  return (
    <div className="mt-3 bg-green-50 border border-green-200 rounded px-4 py-3">
      <div className="flex items-center gap-2 text-green-700 font-body font-medium mb-2">
        <CheckCircle className="w-5 h-5" />
        Import complete
      </div>
      <div className="font-body text-sm text-body space-y-1">
        <p>{result.imported} clients imported</p>
        <p>{result.updated} clients updated</p>
        <p>{result.skipped} clients skipped (no new info or insufficient data)</p>
      </div>
      {result.errors.length > 0 && (
        <details className="mt-2">
          <summary className="font-body text-sm text-red-700 cursor-pointer">
            {result.errors.length} error{result.errors.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 text-xs font-body text-gray-dark space-y-1">
            {result.errors.map((e, i) => (
              <li key={i}>Row {e.row}: {e.error}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-3 flex gap-3">
        <button
          onClick={onReset}
          className="border border-gray-med hover:border-body text-gray-dark px-3 py-1 rounded font-body text-sm transition-colors"
        >
          Import another file
        </button>
        <Link
          href="/clients"
          className="bg-body hover:bg-body-hover text-white px-3 py-1 rounded font-body text-sm transition-colors"
        >
          View Clients
        </Link>
      </div>
    </div>
  )
}

function PurchasesSummary({
  result,
  onReset,
  canCreateClients,
  creatingClients,
  onCreateClients,
}: {
  result: Exclude<PurchasesResult, { error: string }>
  onReset: () => void
  canCreateClients: boolean
  creatingClients: boolean
  onCreateClients: (names: string[]) => Promise<void>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const missing = useMemo(() => distinctUnmatchedNames(result.unmatched), [result.unmatched])
  const n = missing.length

  async function confirmCreate() {
    await onCreateClients(missing.map((m) => m.name))
    setConfirmOpen(false)
  }

  return (
    <div className="mt-3 bg-green-50 border border-green-200 rounded px-4 py-3">
      <div className="flex items-center gap-2 text-green-700 font-body font-medium mb-2">
        <CheckCircle className="w-5 h-5" />
        Import complete
      </div>
      <div className="font-body text-sm text-body space-y-1">
        <p data-testid="import-custom-created">{result.customCreated} custom garments added</p>
        <p data-testid="import-ready-created">{result.readyMadeCreated} ready-made purchases added</p>
        {result.updated !== undefined && (
          <p data-testid="import-updated">{result.updated} existing items corrected (per-item price / quantity)</p>
        )}
        <p>{result.unchanged ?? result.deduped} already in the CRM and unchanged</p>
        <p>
          {result.skipped} lines skipped total (
          {result.serviceLines} service, {result.discountLines} discount,
          {result.outOfScopeLines !== undefined ? ` ${result.outOfScopeLines} out-of-scope,` : ''}
          {result.refundLines !== undefined ? ` ${result.refundLines} refund,` : ''}
          {result.insertErrors !== undefined ? ` ${result.insertErrors} insert error${result.insertErrors === 1 ? '' : 's'},` : ''}
          {' '}{result.unmatched.length} unmatched, {result.needsReview.length} needs review)
        </p>
      </div>

      {result.unmatched.length > 0 && (
        <details className="mt-3" open data-testid="unmatched-customers">
          <summary className="font-body text-sm font-medium text-yellow-800 cursor-pointer">
            {n > 0
              ? `${n} customer${n === 1 ? '' : 's'} not in the CRM (${result.unmatched.length} line${result.unmatched.length === 1 ? '' : 's'} skipped)`
              : `Could not match ${result.unmatched.length} line${result.unmatched.length === 1 ? '' : 's'} (no customer name)`}
          </summary>
          {n > 0 && (
            <>
              <p className="text-xs font-body text-gray-dark mt-1 mb-2">
                Their purchases were skipped because no client has that name. Create them as new clients (name only — you can
                add email and phone later) and the import runs again to bring their purchases in.
              </p>
              <ul className="text-xs font-body text-gray-dark space-y-1 max-h-40 overflow-auto" data-testid="unmatched-names">
                {missing.map((m) => (
                  <li key={m.name}>
                    <span className="text-body">{m.name}</span>
                    <span> · {m.lines} line{m.lines === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
              {canCreateClients && (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={creatingClients}
                  className="es-btn es-btn-primary h-[44px] mt-3"
                  data-testid="create-missing-clients"
                >
                  {creatingClients && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create {n} client{n === 1 ? '' : 's'} and re-import
                </button>
              )}
            </>
          )}
        </details>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Create ${n} new client${n === 1 ? '' : 's'}?`}
        message={
          <>
            {n} client{n === 1 ? '' : 's'} will be added with just a name (stage Active, source QuickBooks import), then
            this file is imported again so their purchases are added. Names that already match a client are skipped.
          </>
        }
        confirmLabel={`Create ${n} and re-import`}
        busy={creatingClients}
        onConfirm={confirmCreate}
        onCancel={() => setConfirmOpen(false)}
      />

      {result.needsReview.length > 0 && (
        <details className="mt-3" open>
          <summary className="font-body text-sm font-medium text-yellow-800 cursor-pointer">
            Needs review: {result.needsReview.length} line{result.needsReview.length === 1 ? '' : 's'}
          </summary>
          <p className="text-xs font-body text-gray-dark mt-1 mb-2">
            These products didn&apos;t match any known custom code or ready-made brand. Add them to the client manually.
          </p>
          <ul className="text-xs font-body text-gray-dark space-y-1 max-h-40 overflow-auto">
            {result.needsReview.map((n, i) => (
              <li key={i}>
                Row {n.row} ({n.customer}): <span className="text-body">{n.product}</span>
                {n.description && <span className="text-gray-dark"> — {n.description}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.errors.length > 0 && (
        <details className="mt-3">
          <summary className="font-body text-sm text-red-700 cursor-pointer">
            {result.errors.length} error{result.errors.length === 1 ? '' : 's'} shown
            {result.errorsTruncated ? ` (${result.errorsTruncated} more truncated)` : ''}
          </summary>
          <ul className="mt-1 text-xs font-body text-gray-dark space-y-1">
            {result.errors.map((e, i) => (
              <li key={i}>Row {e.row}: {e.error}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex gap-3">
        <button
          onClick={onReset}
          className="border border-gray-med hover:border-body text-gray-dark px-3 py-1 rounded font-body text-sm transition-colors"
        >
          Import another file
        </button>
        <Link
          href="/orders"
          className="bg-body hover:bg-body-hover text-white px-3 py-1 rounded font-body text-sm transition-colors"
        >
          View Orders
        </Link>
      </div>
    </div>
  )
}

export default function ImportPage() {
  const [clientsParsed, setClientsParsed] = useState<ParsedFile | null>(null)
  const [purchasesParsed, setPurchasesParsed] = useState<ParsedFile | null>(null)
  // Bumped when a file is handed over, so the purchases zone starts fresh
  // (no leftover result from an earlier import hiding the new file).
  const [purchasesZoneKey, setPurchasesZoneKey] = useState(0)
  const purchasesZoneRef = useRef<HTMLDivElement>(null)

  // The Sales by Customer Detail report was dropped into Import Clients: move the
  // already-parsed file to Import Purchase History and take her there.
  function moveToPurchases(file: ParsedFile) {
    setPurchasesParsed(file)
    setPurchasesZoneKey((k) => k + 1)
    setClientsParsed(null)
  }

  // After the hand-over renders (the clients zone has collapsed), bring the
  // purchases zone into view and move focus there for keyboard / VoiceOver users.
  useEffect(() => {
    if (purchasesZoneKey === 0) return
    const zone = purchasesZoneRef.current
    if (!zone) return
    zone.scrollIntoView({ block: 'start' })
    zone.focus({ preventScroll: true })
  }, [purchasesZoneKey])

  return (
    <Layout currentPage="settings">
      <div className="max-w-3xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-gray-dark hover:text-body font-body text-sm mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <h1 className="font-heading text-lg font-medium text-body mb-2">Import from QuickBooks</h1>
        <p className="font-body text-sm text-gray-dark mb-4">
          Export your data from QuickBooks Online, then upload it here.
          Clients are matched by email → phone → name. Purchases are classified
          using your custom codes (CCP, CCVP, CT, CSC, CSHT…) and ready-made brand
          names (Magnanni, 34 Heritage, Johnston & Murphy, Paige, Liverpool…).
          Interior Design line items, fixtures, services and discounts are auto-skipped.
        </p>

        <div className="bg-gray-light border border-gray-med rounded p-3 mb-4 font-body text-sm text-gray-dark">
          <p className="font-medium text-body mb-1">How to export from QuickBooks</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-body font-medium">Clients:</span> Sales → Customers → ⚙ → Export to Excel (save as .xls or .xlsx — the importer reads both)</li>
            <li><span className="text-body font-medium">Purchases:</span> Reports → Sales by Customer Detail → Export to CSV (grouped format is auto-flattened on upload)</li>
          </ul>
        </div>

        <div className="space-y-4">
          <UploadZone mode="clients" parsed={clientsParsed} setParsed={setClientsParsed} onMoveToPurchases={moveToPurchases} />
          <div
            ref={purchasesZoneRef}
            tabIndex={-1}
            aria-label="Import Purchase History"
            className="outline-none scroll-mt-4"
            data-testid="purchases-zone-anchor"
          >
            <UploadZone key={purchasesZoneKey} mode="purchases" parsed={purchasesParsed} setParsed={setPurchasesParsed} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
