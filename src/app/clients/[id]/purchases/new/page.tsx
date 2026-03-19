'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLog'

const categories = [
  { value: 'shoes', label: 'Shoes' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'belt', label: 'Belt' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
]

const commonBrands = [
  'Magnanni',
  '34 Heritage',
  'Peter Millar',
  'Canali',
  'Zegna',
  'Other',
]

export default function NewPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category: 'shoes',
    brand: '',
    product_name: '',
    description: '',
    size: '',
    price: '',
    quantity: '1',
    purchase_date: new Date().toISOString().split('T')[0],
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!formData.product_name.trim()) {
      setError('Product name is required.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('ready_made_purchases')
      .insert({
        client_id: clientId,
        category: formData.category,
        brand: formData.brand.trim() || null,
        product_name: formData.product_name.trim(),
        description: formData.description.trim() || null,
        size: formData.size.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        quantity: parseInt(formData.quantity) || 1,
        purchase_date: formData.purchase_date || null,
      })

    if (insertError) {
      console.error('Error saving purchase:', insertError)
      setError('Failed to save purchase. Please try again.')
      setSaving(false)
      return
    }

    // Update client's last_purchase_date
    await supabase
      .from('clients')
      .update({
        last_purchase_date: formData.purchase_date,
        last_contact_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', clientId)

    // Log activity
    await logActivity({
      clientId: clientId,
      activityType: 'purchase_added',
      title: `Ready-made purchase: ${formData.brand ? formData.brand + ' ' : ''}${formData.product_name}`,
      description: formData.size ? `Size: ${formData.size}` : undefined,
      metadata: { category: formData.category, price: formData.price },
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
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-8">
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Client
        </Link>

        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-[#F0EEEB]" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h1 className="font-heading text-xl font-medium text-[#2D2D2D] mb-6">Add Ready-Made Purchase</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-2">
                Category *
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`px-4 py-2 rounded-xl font-body text-sm font-semibold transition-colors ${
                      formData.category === cat.value
                        ? 'bg-[#2D2D2D] text-white'
                        : 'bg-gray-light text-[#8A8A8A] hover:bg-[#F0EEEB]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand and Product Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  list="brand-suggestions"
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="Magnanni"
                />
                <datalist id="brand-suggestions">
                  {commonBrands.map(brand => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="Oxford Dress Shoe"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Description / Color
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                placeholder="Black, Brown, Cherry"
              />
            </div>

            {/* Size, Quantity, Price */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Size
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                  placeholder="9.5 or 34x32"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                  Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-dark">$</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                    placeholder="450.00"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
              />
            </div>

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
                    Save Purchase
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
