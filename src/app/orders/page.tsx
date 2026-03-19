'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

type Client = {
  id: string
  first_name: string
  last_name: string
}

type CustomOrder = {
  id: string
  client_id: string
  garment_type: string
  fabric_name: string | null
  fabric_code: string | null
  price: number | null
  status: string
  order_date: string
  eta_start: string | null
  eta_end: string | null
  clients: Client
}

type StatusFilter = 'all' | 'in_progress' | 'ordered' | 'blue_pencil' | 'cutting' | 'sewing' | 'shipping' | 'delivered'

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function loadOrders() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('custom_orders')
        .select('*, clients(id, first_name, last_name)')
        .order('order_date', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
      } else {
        setOrders(data as CustomOrder[])
      }
      setLoading(false)
    }

    loadOrders()
  }, [])

  const getFilteredOrders = () => {
    if (activeFilter === 'all') return orders
    if (activeFilter === 'in_progress') return orders.filter(o => o.status !== 'delivered')
    return orders.filter(o => o.status === activeFilter)
  }

  const filteredOrders = getFilteredOrders()

  const statusCounts = {
    all: orders.length,
    in_progress: orders.filter(o => o.status !== 'delivered').length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    blue_pencil: orders.filter(o => o.status === 'blue_pencil').length,
    cutting: orders.filter(o => o.status === 'cutting').length,
    sewing: orders.filter(o => o.status === 'sewing').length,
    shipping: orders.filter(o => o.status === 'shipping').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }

  return (
    <Layout currentPage="orders">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Orders</h1>
          <p className="font-body text-gray-dark">
            {filteredOrders.length} {activeFilter === 'all' ? 'total' : activeFilter.replace(/_/g, ' ')} order{filteredOrders.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label="All"
            count={statusCounts.all}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatusPill
            label="In Progress"
            count={statusCounts.in_progress}
            active={activeFilter === 'in_progress'}
            onClick={() => setActiveFilter('in_progress')}
            color="bg-orange-500"
          />
          <StatusPill
            label="Ordered"
            count={statusCounts.ordered}
            active={activeFilter === 'ordered'}
            onClick={() => setActiveFilter('ordered')}
            color="bg-gray-med"
          />
          <StatusPill
            label="Blue Pencil"
            count={statusCounts.blue_pencil}
            active={activeFilter === 'blue_pencil'}
            onClick={() => setActiveFilter('blue_pencil')}
            color="bg-purple-500"
          />
          <StatusPill
            label="Cutting"
            count={statusCounts.cutting}
            active={activeFilter === 'cutting'}
            onClick={() => setActiveFilter('cutting')}
            color="bg-blue-500"
          />
          <StatusPill
            label="Sewing"
            count={statusCounts.sewing}
            active={activeFilter === 'sewing'}
            onClick={() => setActiveFilter('sewing')}
            color="bg-orange-500"
          />
          <StatusPill
            label="Shipping"
            count={statusCounts.shipping}
            active={activeFilter === 'shipping'}
            onClick={() => setActiveFilter('shipping')}
            color="bg-green-400"
          />
          <StatusPill
            label="Delivered"
            count={statusCounts.delivered}
            active={activeFilter === 'delivered'}
            onClick={() => setActiveFilter('delivered')}
            color="bg-green-600"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 text-gray-med mx-auto mb-4" />
          {orders.length === 0 ? (
            <>
              <h2 className="font-heading text-xl text-gray-dark">No orders yet</h2>
              <p className="font-body text-gray-dark mt-2">Orders will appear here when you add them to client profiles.</p>
            </>
          ) : (
            <>
              <h2 className="font-heading text-xl text-gray-dark">No {activeFilter.replace(/_/g, ' ')} orders</h2>
              <p className="font-body text-gray-dark mt-2">Try selecting a different filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-med overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-light">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium">Garment</th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium hidden md:table-cell">Fabric</th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium hidden lg:table-cell">ETA / Date</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-[0.05em] text-[#8A8A8A] font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}

function StatusPill({
  label,
  count,
  active = false,
  onClick,
  color,
}: {
  label: string
  count: number
  active?: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl font-body text-sm transition-colors flex items-center gap-2 ${
        active
          ? 'bg-[#2D2D2D] text-white rounded-xl'
          : 'bg-white text-gray-dark border border-gray-med hover:border-[#2D2D2D] rounded-xl'
      }`}
    >
      {color && !active && (
        <span className={`w-2 h-2 rounded-full ${color}`} />
      )}
      {label} ({count})
    </button>
  )
}

function OrderRow({ order }: { order: CustomOrder }) {
  const statusColors: Record<string, string> = {
    ordered: 'bg-gray-200 text-gray-700',
    blue_pencil: 'bg-purple-100 text-purple-700',
    cutting: 'bg-blue-100 text-blue-700',
    sewing: 'bg-orange-100 text-orange-700',
    shipping: 'bg-green-100 text-green-700',
    delivered: 'bg-green-500 text-white',
  }

  const isDelivered = order.status === 'delivered'

  return (
    <tr className={`border-t border-gray-med hover:bg-gray-light transition-colors ${isDelivered ? 'opacity-60' : ''}`}>
      <td className="px-4 py-4">
        <Link href={`/clients/${order.client_id}`} className="font-body font-medium text-[#8A8A8A] hover:text-[#2D2D2D]">
          {order.clients.first_name} {order.clients.last_name}
        </Link>
      </td>
      <td className="px-4 py-4 font-body text-sm">{order.garment_type}</td>
      <td className="px-4 py-4 font-body text-sm text-gray-dark hidden md:table-cell">
        {order.fabric_name || '—'}
      </td>
      <td className="px-4 py-4">
        <Link href={`/clients/${order.client_id}/orders/${order.id}/edit`}>
          <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium uppercase ${statusColors[order.status] || statusColors.ordered}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </Link>
      </td>
      <td className="px-4 py-4 font-body text-sm hidden lg:table-cell">
        {isDelivered ? (
          <span className="text-gray-dark">
            {new Date(order.order_date).toLocaleDateString()}
          </span>
        ) : order.eta_start && order.eta_end ? (
          <span>
            {new Date(order.eta_start).toLocaleDateString()} - {new Date(order.eta_end).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-gray-dark">—</span>
        )}
      </td>
      <td className="px-4 py-4 font-body text-sm text-right font-medium">
        {order.price ? `$${order.price.toLocaleString()}` : '—'}
      </td>
    </tr>
  )
}
