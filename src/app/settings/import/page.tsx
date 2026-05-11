'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react'
import Layout from '@/components/Layout'

const CLIENT_FIELDS = [
  { key: '', label: '— skip —' },
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
  if (/^(customer|client)$/.test(h) || /full\s*name/.test(h) || /display\s*name/.test(h)) {
    return 'first_name'
  }
  if (/^first|given/.test(h)) return 'first_name'
  if (/^last|family|surname/.test(h)) return 'last_name'
  if (/e[-\s]?mail/.test(h)) return 'email'
  if (/phone|mobile|cell/.test(h)) return 'phone'
  if (/company|business/.test(h)) return 'company'
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
  skipped: number
  deduped: number
  serviceLines: number
  discountLines: number
  total: number
  unmatched: Array<{ row: number; customer: string }>
  needsReview: Array<{ row: number; customer: string; product: string; description: string }>
  errors: Array<{ row: number; error: string }>
} | { error: string }

function UploadZone({
  mode,
  parsed,
  setParsed,
}: {
  mode: Mode
  parsed: ParsedFile | null
  setParsed: (p: ParsedFile | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ClientsResult | PurchasesResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fields = mode === 'clients' ? CLIENT_FIELDS : PURCHASE_FIELDS
  const apiPath = mode === 'clients' ? '/api/import/clients' : '/api/import/purchases'
  const title = mode === 'clients' ? 'Import Clients' : 'Import Purchase History'
  const subtitle =
    mode === 'clients'
      ? 'Upload the QBO Customers CSV (Sales → Customers → Export to Excel, saved as CSV).'
      : 'Upload the QBO Sales CSV (Reports → Sales by Customer Detail, exported as CSV).'

  const handleFile = useCallback(
    (file: File) => {
      setParseError(null)
      setResult(null)
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setParseError('Please upload a .csv file.')
        return
      }
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (res) => {
          if (res.errors.length > 0 && res.data.length === 0) {
            setParseError(`Parse error: ${res.errors[0].message}`)
            return
          }
          const headers = res.meta.fields || []
          const rows = res.data
          const guesser = mode === 'clients' ? guessClientField : guessPurchaseField
          const initialMapping: Record<string, string> = {}
          for (const h of headers) initialMapping[h] = guesser(h)
          setMapping(initialMapping)
          setParsed({ headers, rows, fileName: file.name })
        },
        error: (err) => setParseError(`Failed to read file: ${err.message}`),
      })
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

  const requiredMissing = useMemo(() => {
    if (!parsed) return []
    const mapped = new Set(Object.values(mapping).filter(Boolean))
    const missing: string[] = []
    if (mode === 'clients') {
      const hasName = mapped.has('first_name') || mapped.has('last_name')
      const hasContact = mapped.has('email') || mapped.has('phone')
      if (!hasName) missing.push('first/last name')
      if (!hasContact) missing.push('email or phone')
    } else {
      if (!mapped.has('customer')) missing.push('customer')
      if (!mapped.has('product')) missing.push('product')
    }
    return missing
  }, [mapping, mode, parsed])

  async function handleSubmit() {
    if (!parsed) return
    setSubmitting(true)
    setResult(null)
    try {
      const transformed = parsed.rows.map((raw) => {
        const out: Record<string, string> = {}
        for (const header of parsed.headers) {
          const field = mapping[header]
          if (field && raw[header] !== undefined) out[field] = raw[header]
        }
        return out
      })
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

  function reset() {
    setParsed(null)
    setMapping({})
    setResult(null)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-white rounded p-4 border border-gray-med">
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
            Drop your CSV here, or click to browse
          </p>
          <p className="font-body text-xs text-gray-dark">.csv files only</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
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

      {parsed && !result && (
        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-2 text-sm font-body text-gray-dark">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-body">{parsed.fileName}</span>
            <span>·</span>
            <span>{parsed.rows.length} rows</span>
          </div>

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
                        {mapping[h] && (
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
                        <td key={h} className="px-2 py-1 text-gray-dark whitespace-nowrap max-w-[12rem] truncate" title={row[h]}>
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {requiredMissing.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded font-body text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Map at least: {requiredMissing.join(', ')}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || requiredMissing.length > 0}
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
        <PurchasesSummary result={result as Exclude<PurchasesResult, { error: string }>} onReset={reset} />
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
}: {
  result: Exclude<PurchasesResult, { error: string }>
  onReset: () => void
}) {
  return (
    <div className="mt-3 bg-green-50 border border-green-200 rounded px-4 py-3">
      <div className="flex items-center gap-2 text-green-700 font-body font-medium mb-2">
        <CheckCircle className="w-5 h-5" />
        Import complete
      </div>
      <div className="font-body text-sm text-body space-y-1">
        <p>{result.customCreated} custom orders created</p>
        <p>{result.readyMadeCreated} ready-made purchases created</p>
        <p>{result.deduped} duplicates skipped</p>
        <p>
          {result.skipped} lines skipped total (
          {result.serviceLines} service, {result.discountLines} discount,
          {' '}{result.unmatched.length} unmatched, {result.needsReview.length} needs review)
        </p>
      </div>

      {result.unmatched.length > 0 && (
        <details className="mt-3" open>
          <summary className="font-body text-sm font-medium text-yellow-800 cursor-pointer">
            Could not match {result.unmatched.length} customer{result.unmatched.length === 1 ? '' : 's'}
          </summary>
          <p className="text-xs font-body text-gray-dark mt-1 mb-2">
            Add these clients manually (or import them via the Clients CSV first), then re-run this import.
          </p>
          <ul className="text-xs font-body text-gray-dark space-y-1 max-h-40 overflow-auto">
            {result.unmatched.map((u, i) => (
              <li key={i}>Row {u.row}: <span className="text-body">{u.customer}</span></li>
            ))}
          </ul>
        </details>
      )}

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

        <h1 className="font-heading text-lg font-medium text-body mb-2">Import from QuickBooks (CSV)</h1>
        <p className="font-body text-sm text-gray-dark mb-4">
          Export your data from QuickBooks Online, then upload the CSVs below.
          Clients are matched by email → phone → name. Purchases are classified
          using your custom item codes (CCVP, CT, CSC…) and ready-made brand names.
        </p>

        <div className="bg-gray-light border border-gray-med rounded p-3 mb-4 font-body text-sm text-gray-dark">
          <p className="font-medium text-body mb-1">How to export from QuickBooks</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-body font-medium">Clients:</span> Sales → Customers → ⚙ → Export to Excel → save as CSV</li>
            <li><span className="text-body font-medium">Purchases:</span> Reports → Sales by Customer Detail → Export → CSV</li>
          </ul>
        </div>

        <div className="space-y-4">
          <UploadZone mode="clients" parsed={clientsParsed} setParsed={setClientsParsed} />
          <UploadZone mode="purchases" parsed={purchasesParsed} setParsed={setPurchasesParsed} />
        </div>
      </div>
    </Layout>
  )
}
