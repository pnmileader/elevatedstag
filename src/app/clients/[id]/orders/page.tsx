'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Plus, Loader2, Package, Truck, Save, X } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import { queuePostDeliveryFollowUp } from '@/lib/emailAutomation'

interface CustomOrder {
  id: string
  garment_type: string
  fabric_name: string
  fabric_code: string
  order_date: string
  status: string
  eta_start: string | null
  eta_end: string | null
  price: number | null
  swatch_image_url: string | null
  custom_swatch_url: string | null
  trinity_garment_id: string | null
  delivered_date: string | null
}

const STATUSES = [
  { value: 'ordered', label: 'Ordered', color: 'bg-gray-100 text-gray-700' },
  { value: 'blue_pencil', label: 'Blue Pencil', color: 'bg-blue-100 text-blue-700' },
  { value: 'cutting', label: 'Cutting', color: 'bg-purple-100 text-purple-700' },
  { value: 'sewing', label: 'Sewing', color: 'bg-orange-100 text-orange-700' },
  { value: 'shipping', label: 'Shipping', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
]

const GARMENT_TYPES = [
  'Suit (2-Piece)',
  'Suit (3-Piece)',
  'Sport Coat',
  'Blazer',
  'Trousers',
  'Vest',
  'Shirt',
  'Overcoat',
  'Tuxedo',
]

export default function ClientOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<{ first_name: string; last_name: string } | null>(null)
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CustomOrder | null>(null)

  // Form state
  const [garmentType, setGarmentType] = useState('')
  const [fabricName, setFabricName] = useState('')
  const [fabricCode, setFabricCode] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [status, setStatus] = useState('ordered')
  const [etaStart, setEtaStart] = useState('')
  const [etaEnd, setEtaEnd] = useState('')
  const [price, setPrice] = useState('')
  const [trinityId, setTrinityId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchData() {
    const supabase = createClient()

    const { data: clientData } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    setClient(clientData)

    const { data: ordersData } = await supabase
      .from('custom_orders')
      .select('*')
      .eq('client_id', id)
      .order('order_date', { ascending: false })

    setOrders(ordersData || [])
    setLoading(false)
  }

  function resetForm() {
    setGarmentType('')
    setFabricName('')
    setFabricCode('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setStatus('ordered')
    setEtaStart('')
    setEtaEnd('')
    setPrice('')
    setTrinityId('')
    setEditingOrder(null)
  }

  function openNewForm() {
    resetForm()
    setShowForm(true)
  }

  function openEditForm(order: CustomOrder) {
    setEditingOrder(order)
    setGarmentType(order.garment_type)
    setFabricName(order.fabric_name || '')
    setFabricCode(order.fabric_code || '')
    setOrderDate(order.order_date)
    setStatus(order.status)
    setEtaStart(order.eta_start || '')
    setEtaEnd(order.eta_end || '')
    setPrice(order.price?.toString() || '')
    setTrinityId(order.trinity_garment_id || '')
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const orderData = {
      client_id: id,
      garment_type: garmentType,
      fabric_name: fabricName || null,
      fabric_code: fabricCode || null,
      order_date: orderDate,
      status,
      eta_start: etaStart || null,
      eta_end: etaEnd || null,
      price: price ? parseFloat(price) : null,
      trinity_garment_id: trinityId || null,
    }

    if (editingOrder) {
      await supabase
        .from('custom_orders')
        .update(orderData)
        .eq('id', editingOrder.id)
    } else {
      await supabase.from('custom_orders').insert(orderData)

      // Log activity
      await supabase.from('activity_log').insert({
        client_id: id,
        activity_type: 'order_placed',
        title: 'New order placed',
        description: `${garmentType}${fabricName ? ` - ${fabricName}` : ''}`,
        metadata: { price: price ? parseFloat(price) : null },
      })
    }

    setShowForm(false)
    resetForm()
    fetchData()
    setSaving(false)
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    const supabase = createClient()

    await supabase
      .from('custom_orders')
      .update({
        status: newStatus,
        delivered_date: newStatus === 'delivered' ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', orderId)

    // Queue post-delivery follow-up email if status changed to delivered
    if (newStatus === 'delivered') {
      await queuePostDeliveryFollowUp(orderId)
    }

    fetchData()
  }

  function getStatusBadge(statusValue: string) {
    const s = STATUSES.find(st => st.value === statusValue)
    return s || STATUSES[0]
  }

  if (loading) {
    return (
      <Layout currentPage="clients">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="clients">
      <div className="max-w-4xl">
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-3 font-body text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {client?.first_name} {client?.last_name}
        </Link>

        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Custom Orders</h1>
            <p className="font-body text-gray-dark">
              {client?.first_name} {client?.last_name} - Trinity Workflow Tracking
            </p>
          </div>

          <button
            onClick={openNewForm}
            className="bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Order
          </button>
        </div>

        {/* Order Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-3 lg:p-3 border-b border-gray-med flex items-center justify-between">
                <h2 className="font-heading text-base font-medium text-body">
                  {editingOrder ? 'Edit Order' : 'New Custom Order'}
                </h2>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="p-2 hover:bg-gray-light rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-2">
                <div>
                  <label className="block font-body font-medium text-sm mb-2">
                    Garment Type *
                  </label>
                  <select
                    value={garmentType}
                    onChange={(e) => setGarmentType(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-body"
                  >
                    <option value="">Select type...</option>
                    {GARMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      Fabric Name
                    </label>
                    <input
                      type="text"
                      value={fabricName}
                      onChange={(e) => setFabricName(e.target.value)}
                      placeholder="e.g., Navy Pinstripe"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      Fabric Code
                    </label>
                    <input
                      type="text"
                      value={fabricCode}
                      onChange={(e) => setFabricCode(e.target.value)}
                      placeholder="e.g., V4-49146039"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      Order Date *
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      Price
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-body font-medium text-sm mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-body"
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      ETA Start
                    </label>
                    <input
                      type="date"
                      value={etaStart}
                      onChange={(e) => setEtaStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">
                      ETA End
                    </label>
                    <input
                      type="date"
                      value={etaEnd}
                      onChange={(e) => setEtaEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-body font-medium text-sm mb-2">
                    Trinity Garment ID
                  </label>
                  <input
                    type="text"
                    value={trinityId}
                    onChange={(e) => setTrinityId(e.target.value)}
                    placeholder="e.g., T2-1822800"
                    className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                  />
                </div>
              </div>

              <div className="p-3 lg:p-3 border-t border-gray-med flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !garmentType || !orderDate}
                  className="flex-1 bg-body hover:bg-body-hover disabled:bg-gray-med text-white py-2 rounded font-body font-medium flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingOrder ? 'Update Order' : 'Add Order'}
                </button>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-3 py-2 border border-gray-med rounded font-body font-medium text-gray-dark hover:border-body"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded p-3 text-center border border-gray-med">
            <Package className="w-12 h-12 text-gray-med mx-auto mb-4" />
            <p className="font-body text-gray-dark mb-4">No custom orders yet</p>
            <button
              onClick={openNewForm}
              className="text-gray-dark hover:text-body font-body text-sm font-medium"
            >
              Add the first order →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => {
              const statusInfo = getStatusBadge(order.status)

              return (
                <div
                  key={order.id}
                  className="bg-white rounded border border-gray-med overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2">
                        {/* Swatch placeholder */}
                        <div className="w-16 h-16 bg-gray-light rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          {order.custom_swatch_url || order.swatch_image_url ? (
                            <img
                              src={order.custom_swatch_url || order.swatch_image_url || ''}
                              alt="Fabric swatch"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-dark" />
                          )}
                        </div>

                        <div>
                          <h3 className="font-body font-medium text-lg">{order.garment_type}</h3>
                          {order.fabric_name && (
                            <p className="font-body text-sm text-gray-dark">
                              {order.fabric_name}
                              {order.fabric_code && <span className="text-gray-dark ml-2">({order.fabric_code})</span>}
                            </p>
                          )}
                          {order.trinity_garment_id && (
                            <p className="font-body text-xs text-gray-dark mt-1">
                              Trinity ID: {order.trinity_garment_id}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        {order.price && (
                          <p className="font-heading text-lg font-medium text-body">
                            ${order.price.toLocaleString()}
                          </p>
                        )}
                        <p className="font-body text-xs text-gray-dark">
                          Ordered {new Date(order.order_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Status and ETA */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-light">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {order.eta_start && order.eta_end && order.status !== 'delivered' && (
                          <span className="font-body text-xs text-gray-dark flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            ETA: {new Date(order.eta_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(order.eta_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {order.delivered_date && (
                          <span className="font-body text-xs text-green-600 flex items-center gap-1">
                            Delivered {new Date(order.delivered_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick status update buttons */}
                        {order.status !== 'delivered' && (
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className="px-2 py-1 border border-gray-med rounded text-xs font-body focus:outline-none focus:border-body"
                          >
                            {STATUSES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => openEditForm(order)}
                          className="text-gray-dark hover:text-body font-body text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
