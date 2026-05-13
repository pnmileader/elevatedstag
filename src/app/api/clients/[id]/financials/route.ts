// Compute a client's financial summary from local Supabase data.
// (Previously fetched live from QuickBooks; OAuth has been removed.)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id || typeof id !== 'string' || id.length > 64) {
    return NextResponse.json({ error: 'Invalid client id' }, { status: 400 })
  }

  const [ordersRes, purchasesRes] = await Promise.all([
    supabase
      .from('custom_orders')
      .select('price, order_date')
      .eq('client_id', id),
    supabase
      .from('ready_made_purchases')
      .select('price, quantity, purchase_date')
      .eq('client_id', id),
  ])

  if (ordersRes.error || purchasesRes.error) {
    return NextResponse.json(
      { error: 'Failed to load financial data' },
      { status: 500 },
    )
  }

  const orders = ordersRes.data || []
  const purchases = purchasesRes.data || []

  const orderTotal = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0)
  const purchaseTotal = purchases.reduce(
    (sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 1),
    0,
  )

  const lifetimeValue = orderTotal + purchaseTotal
  const totalOrders = orders.length + purchases.length
  const averageOrder = totalOrders > 0 ? lifetimeValue / totalOrders : 0

  const allDates = [
    ...orders.map((o) => o.order_date).filter(Boolean),
    ...purchases.map((p) => p.purchase_date).filter(Boolean),
  ] as string[]
  const lastPaymentDate = allDates.length > 0 ? allDates.sort().slice(-1)[0] : null

  return NextResponse.json({
    lifetime_value: lifetimeValue,
    total_orders: totalOrders,
    average_order: averageOrder,
    balance_due: 0, // Open balances live in QBO and are no longer accessible.
    last_payment_date: lastPaymentDate,
  })
}
