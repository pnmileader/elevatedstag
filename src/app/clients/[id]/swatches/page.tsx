'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import {
  Grid,
  Filter,
  X,
  Upload,
  Package,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  Eye,
  Calendar,
  Hash,
  Camera,
} from 'lucide-react'
import { formatDateOnly } from '@/lib/dates'
import { uploadSwatch } from '@/lib/swatchUpload'
import { useToast } from '@/components/motion/Toast'

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
  const [choosingOrder, setChoosingOrder] = useState(false)
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingOrderRef = useRef<CustomOrder | null>(null)
  const toast = useToast()

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

  // Opening the file picker has to happen inside the tap, so callers invoke this from a click handler.
  function pickPhotoFor(order: CustomOrder) {
    pendingOrderRef.current = order
    setChoosingOrder(false)
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const order = pendingOrderRef.current
    e.target.value = '' // let the same file be picked again
    if (!file || !order) return

    setUploadingOrderId(order.id)
    try {
      const url = await uploadSwatch(createClient(), {
        file,
        clientId: id,
        orderId: order.id,
        previousUrl: order.swatch_image_url,
      })
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, swatch_image_url: url } : o)))
      setSelectedOrder((prev) => (prev && prev.id === order.id ? { ...prev, swatch_image_url: url } : prev))
      toast.success('Swatch photo saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The photo didn’t upload. Please try again.')
    } finally {
      setUploadingOrderId(null)
      pendingOrderRef.current = null
    }
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
              onClick={() => setChoosingOrder(true)}
              disabled={orders.length === 0}
              data-testid="swatch-upload-open"
              className="inline-flex items-center gap-2 min-h-[44px] bg-body hover:bg-body-hover disabled:bg-gray-med text-white px-4 py-2 rounded font-body text-sm transition-colors self-start"
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

        {/* One hidden picker serves every order; on iPad it offers Take Photo or Photo Library. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChosen}
          data-testid="swatch-file-input"
        />

        {/* Detail Modal */}
        {selectedOrder && (
          <SwatchDetailModal
            order={selectedOrder}
            clientId={id}
            clientName={clientName}
            uploading={uploadingOrderId === selectedOrder.id}
            onAddPhoto={() => pickPhotoFor(selectedOrder)}
            onClose={() => setSelectedOrder(null)}
          />
        )}

        {/* "Upload Swatch": choose which order the photo belongs to */}
        {choosingOrder && (
          <OrderChooserModal
            orders={orders}
            uploadingOrderId={uploadingOrderId}
            onChoose={pickPhotoFor}
            onClose={() => setChoosingOrder(false)}
          />
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
            <ImageIcon className="w-8 h-8 text-white/40" />
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
          {formatDateOnly(order.order_date)}
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
  uploading,
  onAddPhoto,
  onClose,
}: {
  order: CustomOrder
  clientId: string
  clientName: string
  uploading: boolean
  onAddPhoto: () => void
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
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 t-backdrop-mount"
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
              <ImageIcon className="w-16 h-16 text-white/30" />
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
            aria-label="Close"
            className="absolute top-3 right-3 w-[44px] h-[44px] bg-black/50 hover:bg-black/70 text-white rounded flex items-center justify-center transition-colors"
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
                {formatDateOnly(order.order_date)}
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
                  {formatDateOnly(order.eta_start)} &ndash;{' '}
                  {formatDateOnly(order.eta_end)}
                </p>
              </div>
            )}
            {order.delivered_date && order.status === 'delivered' && (
              <div className="col-span-2">
                <p className="font-body text-xs text-gray-dark uppercase tracking-wide mb-0.5">Delivered</p>
                <p className="font-body text-sm font-medium">
                  {formatDateOnly(order.delivered_date)}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-med">
            <button
              type="button"
              onClick={onAddPhoto}
              disabled={uploading}
              data-testid="swatch-add-photo"
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-light text-body border border-body px-4 py-2.5 rounded font-body text-sm font-medium transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {uploading ? 'Uploading…' : order.swatch_image_url ? 'Replace Photo' : 'Add Swatch Photo'}
            </button>
            <Link
              href={`/clients/${clientId}/orders/${order.id}/edit`}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center bg-body hover:bg-body-hover text-white text-center px-4 py-2.5 rounded font-body text-sm font-medium transition-colors"
            >
              Edit Order
            </Link>
            <button
              onClick={onClose}
              className="flex-1 min-h-[44px] bg-white hover:bg-gray-light text-gray-dark border border-gray-med text-center px-4 py-2.5 rounded font-body text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Order chooser (header "Upload Swatch")                                    */
/* -------------------------------------------------------------------------- */

function OrderChooserModal({
  orders,
  uploadingOrderId,
  onChoose,
  onClose,
}: {
  orders: CustomOrder[]
  uploadingOrderId: string | null
  onChoose: (order: CustomOrder) => void
  onClose: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 t-backdrop-mount"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swatch-chooser-title"
        data-testid="swatch-order-chooser"
        className="bg-white rounded shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col t-modal-mount"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-med">
          <div>
            <h2 id="swatch-chooser-title" className="font-heading text-base font-medium text-body">Which order is this swatch for?</h2>
            <p className="font-body text-xs text-gray-dark mt-0.5">Tap an order, then take or choose the photo.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-[44px] h-[44px] -mr-2 flex items-center justify-center text-gray-dark hover:text-body"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="overflow-y-auto divide-y divide-gray-light">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => onChoose(order)}
                disabled={uploadingOrderId === order.id}
                className="w-full min-h-[56px] px-5 py-2 flex items-center gap-3 text-left hover:bg-gray-light active:bg-gray-light"
              >
                <span className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-light flex items-center justify-center">
                  {order.swatch_image_url ? (
                    <img src={order.swatch_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-gray-dark" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-body text-sm font-medium text-body truncate">
                    {order.garment_type}{order.fabric_name ? ` · ${order.fabric_name}` : ''}
                  </span>
                  <span className="block font-body text-xs text-gray-dark truncate">
                    {[order.fabric_code, formatDateOnly(order.order_date)].filter(Boolean).join(' · ')}
                    {order.swatch_image_url ? ' · has photo' : ''}
                  </span>
                </span>
                {uploadingOrderId === order.id && <Loader2 className="w-4 h-4 animate-spin text-gray-dark" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
