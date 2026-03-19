'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLog'

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

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    garment_type: '',
    fabric_name: '',
    fabric_code: '',
    price: '',
    order_date: new Date().toISOString().split('T')[0],
    status: 'ordered',
    eta_start: '',
    eta_end: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!formData.garment_type) {
      setError('Please select a garment type.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('custom_orders')
      .insert({
        client_id: clientId,
        garment_type: formData.garment_type,
        fabric_name: formData.fabric_name.trim() || null,
        fabric_code: formData.fabric_code.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        order_date: formData.order_date,
        status: formData.status,
        eta_start: formData.eta_start || null,
        eta_end: formData.eta_end || null,
      })

    if (insertError) {
      console.error('Error saving order:', insertError)
      setError('Failed to save order. Please try again.')
      setSaving(false)
      return
    }

    // Update client's last_purchase_date
    await supabase
      .from('clients')
      .update({
        last_purchase_date: formData.order_date,
        last_contact_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', clientId)

    // Log activity
    await logActivity({
      clientId: clientId,
      activityType: 'order_placed',
      title: `New ${formData.garment_type} order`,
      description: formData.fabric_name ? `Fabric: ${formData.fabric_name}` : undefined,
      metadata: { price: formData.price, garment_type: formData.garment_type },
    })

    router.push(`/clients/${clientId}`)
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
          <h1 className="font-heading text-xl font-medium text-[#2D2D2D] mb-6">Add Custom Order</h1>

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
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
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
                    Save Order
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
