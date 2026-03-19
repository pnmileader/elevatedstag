'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import {
  Grid,
  Filter,
  X,
  Upload,
  Package,
  Image,
  Loader2,
  ArrowLeft,
  Eye,
  Calendar,
  Hash,
} from 'lucide-react'

interface CustomOrder {
  id: string
  garment_type: string
  fabric_name: string | null
  fabric_code: string | null
  price: number | null
  status: string
  order_date: string
  eta_start: string | null
  eta_end: string | null
  swatch_image_url: string | null
  delivered_date: string | null
}

interface Client {
  first_name: string
  last_name: string
}

const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-gray-100 text-gray-700',
  blue_pencil: 'bg-purple-100 text-purple-700',
  cutting: 'bg-blue-100 text-blue-700',
  sewing: 'bg-orange-100 text-orange-700',
  shipping: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
}

const STATUS_DOT_COLORS: Record<string, string> = {
  ordered: 'bg-gray-400',
  blue_pencil: 'bg-purple-500',
  cutting: 'bg-blue-500',
  sewing: 'bg-orange-500',
  shipping: 'bg-cyan-500',
  delivered: 'bg-green-500',
}

const GARMENT_GRADIENTS: Record<string, string> = {
  suits: 'from-slate-700 to-slate-900',
  sportcoats: 'from-amber-700 to-amber-900',
  trousers: 'from-stone-600 to-stone-800',
  shirts: 'from-sky-600 to-sky-800',
  readymade: 'from-zinc-500 to-zinc-700',
}

const GARMENT_TYPE_TABS = ['All', 'Suits', 'Sportcoats', 'Trousers', 'Shirts', 'Readymade'] as const
type GarmentTab = (typeof GARMENT_TYPE_TABS)[number]

const STATUS_FILTER_TABS = ['Active', 'Delivered', 'All'] as const
type StatusTab = (typeof STATUS_FILTER_TABS)[number]

function getGarmentCategory(garmentType: string): string {
  const lower = garmentType.toLowerCase()
  if (lower.includes('suit') || lower.includes('tuxedo')) return 'suits'
  if (lower.includes('sport') || lower.includes('blazer') || lower.includes('coat')) return 'sportcoats'
  if (lower.includes('trouser') || lower.includes('pant')) return 'trousers'
  if (lower.includes('shirt')) return 'shirts'
  return 'readymade'
}

function getGradient(garmentType: string): string {
  const category = getGarmentCategory(garmentType)
  return GARMENT_GRADIENTS[category] || GARMENT_GRADIENTS.readymade
}

export default function SwatchGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [client, setClient] = useState<Client | null>(null)
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [garmentFilter, setGarmentFilter] = useState<GarmentTab>('All')
  const [statusFilter, setStatusFilter] = useState<StatusTab>('Active')
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()

    const [clientRes, ordersRes] = await Promise.all([
      supabase.from('clients').select('first_name, last_name').eq('id', id).single(),
      supabase
        .from('custom_orders')
        .select('id, garment_type, fabric_name, fabric_code, price, status, order_date, eta_start, eta_end, swatch_image_url, delivered_date')
        .eq('client_id', id)
        .order('order_date', { ascending: false }),
    ])

    if (clientRes.data) setClient(clientRes.data)
    if (ordersRes.data) setOrders(ordersRes.data)
    setLoading(false)
  }

  function showToast(message: string) {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  function handleUploadClick() {
    showToast('Coming soon -- Supabase Storage integration is not yet wired up.')
  }

  const filteredOrders = orders.filter((order) => {
    // Garment type filter
    if (garmentFilter !== 'All') {
      const category = getGarmentCategory(order.garment_type)
      if (category !== garmentFilter.toLowerCase()) return false
    }

    // Status filter
    if (statusFilter === 'Active' && order.status === 'delivered') return false
    if (statusFilter === 'Delivered' && order.status !== 'delivered') return false

    return true
  })

  const clientName = client ? `${client.first_name} ${client.last_name}` : ''

  return (
    <Layout currentPage="clients" showSearch={false} showNewClient={false}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-3 py-3">
        {/* Header */}
        <div className="mb-3">
          <Link
            href={`/clients/${id}`}
            className="inline-flex items-center gap-2 text-gray-dark hover:text-body font-body text-sm mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Client
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-lg lg:text-lg font-medium text-body flex items-center gap-3">
                <Grid className="w-7 h-7 text-gray-dark" />
                Fabric Swatches
              </h1>
              {client && (
                <p className="font-body text-sm text-gray-dark mt-1">
                  {clientName} &mdash; {orders.length} order{orders.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <button
              onClick={handleUploadClick}
              className="inline-flex items-center gap-2 bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body text-sm transition-colors self-start"
            >
              <Upload className="w-4 h-4" />
              Upload Swatch
            </button>
          </div>
        </div>

        {/* Garment Type Filter Tabs */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {GARMENT_TYPE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setGarmentFilter(tab)}
                className={`px-4 py-1.5 rounded font-body text-sm font-medium transition-colors ${
                  garmentFilter === tab
                    ? 'bg-body text-white'
                    : 'bg-white text-gray-dark border border-gray-med hover:border-body hover:text-body'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-dark" />
          {STATUS_FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded font-body text-xs font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-body text-white'
                  : 'bg-white text-gray-dark border border-gray-med hover:border-body'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-dark animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-16 h-16 text-gray-med mb-4" />
            <h2 className="font-heading text-xl font-medium text-gray-dark mb-2">No swatches found</h2>
            <p className="font-body text-sm text-gray-dark max-w-md">
              {orders.length === 0
                ? 'This client has no custom orders yet. Create an order to start tracking fabric swatches.'
                : 'No orders match the current filters. Try adjusting your garment type or status filters.'}
            </p>
          </div>
        )}

        {/* Swatch Grid */}
        {!loading && filteredOrders.length > 0 && (
          garmentFilter === 'All' ? (
            // Grouped by garment type with section headers
            <div className="space-y-3">
              {(['Suits', 'Sportcoats', 'Trousers', 'Shirts', 'Readymade'] as const).map(category => {
                const categoryOrders = filteredOrders.filter(
                  order => getGarmentCategory(order.garment_type) === category.toLowerCase()
                )
                if (categoryOrders.length === 0) return null
                const displayName = category === 'Sportcoats' ? 'Sport Coats' : category === 'Readymade' ? 'Ready-Made' : category
                return (
                  <div key={category}>
                    <div className="flex items-center gap-4 mb-4">
                      <h2 className="font-heading text-lg font-medium text-body">{displayName}</h2>
                      <div className="flex-1 h-px bg-gray-med" />
                      <span className="font-body text-sm text-gray-dark">{categoryOrders.length}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryOrders.map((order) => (
                        <SwatchCard
                          key={order.id}
                          order={order}
                          onClick={() => setSelectedOrder(order)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredOrders.map((order) => (
                <SwatchCard
                  key={order.id}
                  order={order}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          )
        )}

        {/* Detail Modal */}
        {selectedOrder && (
          <SwatchDetailModal
            order={selectedOrder}
            clientId={id}
            clientName={clientName}
            onClose={() => setSelectedOrder(null)}
          />
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-dark text-white px-3 py-3 rounded  font-body text-sm flex items-center gap-2 animate-fade-in">
            <Image className="w-4 h-4 text-gray-dark" />
            {toastMessage}
          </div>
        )}
      </div>
    </Layout>
  )
}

/* -------------------------------------------------------------------------- */
/*  Swatch Card                                                               */
/* -------------------------------------------------------------------------- */

function SwatchCard({
  order,
  onClick,
}: {
  order: CustomOrder
  onClick: () => void
}) {
  const gradient = getGradient(order.garment_type)
  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.ordered
  const dotColor = STATUS_DOT_COLORS[order.status] || STATUS_DOT_COLORS.ordered

  return (
    <button
      onClick={onClick}
      className="bg-white rounded border border-gray-med hover:border-body hover: transition-all text-left group focus:outline-none focus:ring-2 focus:ring-body focus:ring-offset-2"
    >
      {/* Image / Placeholder */}
      <div className="relative aspect-square rounded-t-2xl overflow-hidden">
        {order.swatch_image_url ? (
          <img
            src={order.swatch_image_url}
            alt={`${order.fabric_name || order.fabric_code || 'Swatch'}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 p-4`}
          >
            <Image className="w-8 h-8 text-white/40" />
            {order.fabric_code && (
              <span className="font-heading text-white/70 text-sm font-bold tracking-wider text-center leading-tight">
                {order.fabric_code}
              </span>
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Status dot */}
        <div className="absolute top-2 right-2">
          <span className={`block w-3 h-3 rounded ${dotColor} ring-2 ring-white`} />
        </div>
      </div>

      {/* Details */}
      <div className="p-3">
        {order.fabric_code && (
          <p className="font-heading text-xs font-medium text-gray-dark tracking-wide flex items-center gap-1 mb-0.5">
            <Hash className="w-3 h-3" />
            {order.fabric_code}
          </p>
        )}
        <p className="font-body text-sm font-medium text-gray-dark truncate">
          {order.fabric_name || order.garment_type}
        </p>
        <p className="font-body text-xs text-gray-dark mt-0.5 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(order.order_date).toLocaleDateString()}
        </p>
        <div className="mt-2">
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${statusColor}`}
          >
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Detail Modal                                                              */
/* -------------------------------------------------------------------------- */

function SwatchDetailModal({
  order,
  clientId,
  clientName,
  onClose,
}: {
  order: CustomOrder
  clientId: string
  clientName: string
  onClose: () => void
}) {
  const gradient = getGradient(order.garment_type)
  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.ordered

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Image */}
        <div className="relative aspect-[4/3] rounded-t-2xl overflow-hidden">
          {order.swatch_image_url ? (
            <img
              src={order.swatch_image_url}
              alt={`${order.fabric_name || order.fabric_code || 'Swatch'}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-3`}
            >
              <Image className="w-16 h-16 text-white/30" />
              {order.fabric_code && (
                <span className="font-heading text-white/60 text-lg font-bold tracking-wider">
                  {order.fabric_code}
                </span>
              )}
              <span className="font-body text-white/40 text-sm">No swatch image</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-heading text-xl font-medium text-body">
                {order.garment_type}
              </h2>
              <p className="font-body text-sm text-gray-dark mt-0.5">{clientName}</p>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded text-xs font-medium uppercase tracking-wide flex-shrink-0 ${statusColor}`}
            >
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            {order.fabric_name && (
              <div>
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Fabric</p>
                <p className="font-body text-sm font-medium">{order.fabric_name}</p>
              </div>
            )}
            {order.fabric_code && (
              <div>
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Code</p>
                <p className="font-body text-sm font-medium">{order.fabric_code}</p>
              </div>
            )}
            <div>
              <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Order Date</p>
              <p className="font-body text-sm font-medium">
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>
            {order.price != null && (
              <div>
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Price</p>
                <p className="font-body text-sm font-medium">${order.price.toLocaleString()}</p>
              </div>
            )}
            {order.eta_start && order.eta_end && order.status !== 'delivered' && (
              <div className="col-span-2">
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">ETA</p>
                <p className="font-body text-sm font-medium">
                  {new Date(order.eta_start).toLocaleDateString()} &ndash;{' '}
                  {new Date(order.eta_end).toLocaleDateString()}
                </p>
              </div>
            )}
            {order.delivered_date && order.status === 'delivered' && (
              <div className="col-span-2">
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Delivered</p>
                <p className="font-body text-sm font-medium">
                  {new Date(order.delivered_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-med">
            <Link
              href={`/clients/${clientId}/orders/${order.id}/edit`}
              className="flex-1 bg-body hover:bg-body-hover text-white text-center px-4 py-2.5 rounded font-body text-sm font-medium transition-colors"
            >
              Edit Order
            </Link>
            <button
              onClick={onClose}
              className="flex-1 bg-white hover:bg-gray-light text-gray-dark border border-gray-med text-center px-4 py-2.5 rounded font-body text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
