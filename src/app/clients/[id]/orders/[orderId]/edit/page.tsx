'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const garmentTypes = [
  'Suit',
  '3-Piece Suit',
  'Sport Coat',
  'Blazer',
  'Pant',
  'Vest',
  'Custom Shirt',
  'Overcoat',
  'Tuxedo',
]

const statusOptions = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'blue_pencil', label: 'Blue Pencil' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'sewing', label: 'Sewing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'delivered', label: 'Delivered' },
]

export default function EditOrderPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id: clientId, orderId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    garment_type: '',
    fabric_name: '',
    fabric_code: '',
    price: '',
    order_date: '',
    status: 'ordered',
    eta_start: '',
    eta_end: '',
    delivered_date: '',
  })

  useEffect(() => {
    async function loadOrder() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (error || !data) {
        setError('Order not found')
        setLoading(false)
        return
      }

      setFormData({
        garment_type: data.garment_type || '',
        fabric_name: data.fabric_name || '',
        fabric_code: data.fabric_code || '',
        price: data.price?.toString() || '',
        order_date: data.order_date || '',
        status: data.status || 'ordered',
        eta_start: data.eta_start || '',
        eta_end: data.eta_end || '',
        delivered_date: data.delivered_date || '',
      })
      setLoading(false)
    }
    loadOrder()
  }, [orderId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('custom_orders')
      .update({
        garment_type: formData.garment_type,
        fabric_name: formData.fabric_name.trim() || null,
        fabric_code: formData.fabric_code.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        order_date: formData.order_date,
        status: formData.status,
        eta_start: formData.eta_start || null,
        eta_end: formData.eta_end || null,
        delivered_date: formData.status === 'delivered'
          ? (formData.delivered_date || new Date().toISOString().split('T')[0])
          : null,
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order:', updateError)
      setError('Failed to update order. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/clients/${clientId}`)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('custom_orders')
      .delete()
      .eq('id', orderId)

    if (deleteError) {
      console.error('Error deleting order:', deleteError)
      setError('Failed to delete order. Please try again.')
      setDeleting(false)
      return
    }

    router.push(`/clients/${clientId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-light">
      {/* Header */}
      <header className="bg-white px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-[#F0EEEB]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded-full flex items-center justify-center">
            <span className="text-white font-heading font-semibold text-sm">ES</span>
          </div>
          <span className="font-heading text-[#2D2D2D] text-base font-medium tracking-wide hidden sm:block">
            THE ELEVATED STAG
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Client
        </Link>

        <div className="bg-white rounded-2xl p-8 border border-[#F0EEEB]" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-heading text-xl font-medium text-[#2D2D2D]">Edit Order</h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 font-body text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Order'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Garment Type */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Garment Type *
              </label>
              <select
                name="garment_type"
                value={formData.garment_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold bg-white"
                required
              >
                <option value="">Select garment type...</option>
                {garmentTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Fabric Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Fabric Name
                </label>
                <input
                  type="text"
                  name="fabric_name"
                  value={formData.fabric_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="Navy Pinstripe"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Fabric Code
                </label>
                <input
                  type="text"
                  name="fabric_code"
                  value={formData.fabric_code}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="V4-49146039"
                />
              </div>
            </div>

            {/* Price and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Price
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="$ 4200.00"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Order Date *
                </label>
                <input
                  type="date"
                  name="order_date"
                  value={formData.order_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: option.value }))}
                    className={`px-4 py-2 rounded-xl font-body text-sm font-semibold transition-colors ${
                      formData.status === option.value
                        ? 'bg-[#2D2D2D] text-white'
                        : 'bg-gray-light text-[#8A8A8A] hover:bg-[#F0EEEB]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ETA (shown if not delivered) */}
            {formData.status !== 'delivered' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                    ETA Start
                  </label>
                  <input
                    type="date"
                    name="eta_start"
                    value={formData.eta_start}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                    ETA End
                  </label>
                  <input
                    type="date"
                    name="eta_end"
                    value={formData.eta_end}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            )}

            {/* Delivered Date (shown if delivered) */}
            {formData.status === 'delivered' && (
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Delivered Date
                </label>
                <input
                  type="date"
                  name="delivered_date"
                  value={formData.delivered_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link
                href={`/clients/${clientId}`}
                className="flex-1 px-6 py-3 border border-[#F0EEEB] rounded-xl font-body font-semibold text-gray-dark text-center hover:bg-gray-light transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white px-6 py-3 rounded-xl font-body font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Update Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
