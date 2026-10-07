// POST /api/zapier/quickbooks?type=customer|sale
//
// Zapier calls this when QuickBooks Online gets a new customer, invoice or sales receipt.
// There is no signed-in user, so the request must carry the shared secret in the
// X-CRM-Key header (env ZAPIER_WEBHOOK_SECRET) and the writes use the service-role client.
// Everything runs through the same code as Settings → Import, so a sale Zapier already
// sent is never duplicated by a later manual import (or a Zap re-run), and vice versa.

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createMissingClients, runClientImport, runPurchaseImport } from '@/lib/importRunners'
import { customerFromZapier, saleFromZapier } from '@/lib/zapierQuickbooks'

export const maxDuration = 60

const SOURCE = 'quickbooks_zapier'
// No one reviews a webhook, so never file a sale under someone who only shares a last name.
const STRICT = { lastNameFallback: false }

function authorized(req: NextRequest): boolean {
  const secret = process.env.ZAPIER_WEBHOOK_SECRET
  const given = req.headers.get('x-crm-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!secret || secret.length < 24 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v as object).slice(0, 40) : [])

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const type = req.nextUrl.searchParams.get('type')
  if (type !== 'customer' && type !== 'sale') {
    return NextResponse.json({ error: 'Add ?type=customer or ?type=sale to the webhook URL' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON (set Payload Type to json in Zapier)' }, { status: 400 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })

  if (type === 'customer') {
    const row = customerFromZapier(body)
    if (!row) {
      console.warn('[zapier] customer payload had no name, email or phone; keys:', keysOf(body))
      return NextResponse.json({ error: 'No customer name, email or phone found in the payload', keys: keysOf(body) }, { status: 422 })
    }
    const result = await runClientImport(db, [row], SOURCE)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
    const outcome = result.imported ? 'created' : result.updated ? 'updated' : result.errors.length ? 'error' : 'already up to date'
    return NextResponse.json({ success: result.errors.length === 0, outcome, customer: row.full_name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(), errors: result.errors })
  }

  const sale = saleFromZapier(body)
  if ('error' in sale) {
    console.warn('[zapier] sale payload rejected:', sale.error, 'keys:', keysOf(body))
    return NextResponse.json({ error: sale.error, keys: keysOf(body) }, { status: 422 })
  }
  if (sale.rows.length === 0) {
    return NextResponse.json({ success: true, outcome: 'no item lines', customer: sale.customer })
  }

  // A sale can arrive before (or without) its "new customer" Zap: create the client by name,
  // the same way Import → "Create missing clients" does. The customer Zap fills in the rest.
  const clients = await createMissingClients(db, [sale.customer!], SOURCE, STRICT)
  if ('error' in clients) return NextResponse.json({ error: clients.error }, { status: 500 })

  const result = await runPurchaseImport(db, sale.rows, STRICT)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({
    success: result.insertErrors === 0,
    customer: sale.customer,
    clientCreated: clients.created > 0,
    lines: sale.rows.length,
    customGarmentsAdded: result.customCreated,
    readyMadeAdded: result.readyMadeCreated,
    alreadyInCrm: result.unchanged,
    updated: result.updated,
    serviceOrDiscountLines: result.serviceLines + result.discountLines + result.outOfScopeLines,
    needsReview: result.needsReview,
    unmatched: result.unmatched,
    errors: result.errors,
  })
}
