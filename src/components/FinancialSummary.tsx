'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Loader2 } from 'lucide-react'

interface FinancialData {
  lifetime_value: number
  total_orders: number
  average_order: number
  balance_due: number
  last_payment_date: string | null
  error?: string
}

export default function FinancialSummary({ clientId }: { clientId: string }) {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFinancials() {
      try {
        const response = await fetch(`/api/clients/${clientId}/financials`)
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Error fetching financials:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFinancials()
  }, [clientId])

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div>
        <h3 className="font-heading text-sm font-medium text-body mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gold" />
          QuickBooks Data
        </h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div>
      <h3 className="font-heading text-sm font-medium text-body mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-gold" />
        QuickBooks Data
        {data.error && (
          <span className="text-xs font-normal text-gray-dark ml-2">(Not connected)</span>
        )}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-light rounded p-3 text-center">
          <div className="font-heading text-xl lg:text-lg font-light text-body">
            {formatCurrency(data.lifetime_value)}
          </div>
          <div className="font-body text-[11px] uppercase tracking-[0.05em] text-gray-dark mt-1">Lifetime Value</div>
        </div>
        <div className="bg-gray-light rounded p-3 text-center">
          <div className="font-heading text-xl lg:text-lg font-light text-body">
            {formatCurrency(data.average_order)}
          </div>
          <div className="font-body text-[11px] uppercase tracking-[0.05em] text-gray-dark mt-1">Avg Order</div>
        </div>
        <div className="bg-gray-light rounded p-3 text-center">
          <div className={`font-heading text-xl lg:text-lg font-light ${data.balance_due > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {formatCurrency(data.balance_due)}
          </div>
          <div className="font-body text-[11px] uppercase tracking-[0.05em] text-gray-dark mt-1">Balance Due</div>
        </div>
        <div className="bg-gray-light rounded p-3 text-center">
          <div className="font-heading text-xl lg:text-lg font-light text-body">
            {data.total_orders}
          </div>
          <div className="font-body text-[11px] uppercase tracking-[0.05em] text-gray-dark mt-1">Total Invoices</div>
        </div>
      </div>
    </div>
  )
}
