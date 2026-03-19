import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { quickBooksRequest, getValidAccessToken } from '@/lib/quickbooks'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()

  try {
    // Get the client's QuickBooks ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('quickbooks_id')
      .eq('id', id)
      .single()

    if (clientError || !client?.quickbooks_id) {
      return NextResponse.json({
        lifetime_value: 0,
        total_orders: 0,
        average_order: 0,
        balance_due: 0,
        last_payment_date: null,
      })
    }

    // Check if we have a valid QuickBooks connection
    const auth = await getValidAccessToken()
    if (!auth) {
      return NextResponse.json({
        lifetime_value: 0,
        total_orders: 0,
        average_order: 0,
        balance_due: 0,
        last_payment_date: null,
        error: 'QuickBooks not connected'
      })
    }

    // Fetch invoices for this customer
    const invoicesResponse = await quickBooksRequest(
      `/query?query=SELECT * FROM Invoice WHERE CustomerRef = '${client.quickbooks_id}'`
    )

    const invoices = invoicesResponse.QueryResponse?.Invoice || []

    // Calculate financial summary
    let lifetimeValue = 0
    let balanceDue = 0
    let lastPaymentDate: string | null = null

    for (const invoice of invoices) {
      lifetimeValue += invoice.TotalAmt || 0
      balanceDue += invoice.Balance || 0
      
      // Track the most recent payment
      if (invoice.Balance === 0 && invoice.TxnDate) {
        if (!lastPaymentDate || invoice.TxnDate > lastPaymentDate) {
          lastPaymentDate = invoice.TxnDate
        }
      }
    }

    const totalOrders = invoices.length
    const averageOrder = totalOrders > 0 ? lifetimeValue / totalOrders : 0

    return NextResponse.json({
      lifetime_value: lifetimeValue,
      total_orders: totalOrders,
      average_order: averageOrder,
      balance_due: balanceDue,
      last_payment_date: lastPaymentDate,
    })

  } catch (err) {
    console.error('Error fetching financials:', err)
    return NextResponse.json({
      lifetime_value: 0,
      total_orders: 0,
      average_order: 0,
      balance_due: 0,
      last_payment_date: null,
      error: 'Failed to fetch financial data'
    })
  }
}
