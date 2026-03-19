'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const categories = [
  { value: 'shoes', label: 'Shoes' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'belt', label: 'Belt' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
]

export default function EditPurchasePage({ params }: { params: Promise<{ id: string; purchaseId: string }> }) {
  const { id: clientId, purchaseId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category: 'shoes',
    brand: '',
    product_name: '',
    description: '',
    size: '',
    price: '',
    quantity: '1',
    purchase_date: '',
  })

  useEffect(() => {
    async function loadPurchase() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ready_made_purchases')
        .select('*')
        .eq('id', purchaseId)
        .single()

      if (error || !data) {
        setError('Purchase not found')
        setLoading(false)
        return
      }

      setFormData({
        category: data.category || 'shoes',
        brand: data.brand || '',
        product_name: data.product_name || '',
        description: data.description || '',
        size: data.size || '',
        price: data.price?.toString() || '',
        quantity: data.quantity?.toString() || '1',
        purchase_date: data.purchase_date || '',
      })
      setLoading(false)
    }

    loadPurchase()
  }, [purchaseId])

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
      .from('ready_made_purchases')
      .update({
        category: formData.category,
        brand: formData.brand.trim() || null,
        product_name: formData.product_name.trim(),
        description: formData.description.trim() || null,
        size: formData.size.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        quantity: parseInt(formData.quantity) || 1,
        purchase_date: formData.purchase_date || null,
      })
      .eq('id', purchaseId)

    if (updateError) {
      console.error('Error updating purchase:', updateError)
      setError('Failed to update purchase. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/clients/${clientId}`)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this purchase?')) return

    setDeleting(true)
    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('ready_made_purchases')
      .delete()
      .eq('id', purchaseId)

    if (deleteError) {
      console.error('Error deleting purchase:', deleteError)
      setError('Failed to delete purchase.')
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
      <header className="bg-white px-4 lg:px-3 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-gray-med">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded flex items-center justify-center">
            <span className="text-white font-heading font-semibold text-sm">ES</span>
          </div>
          <span className="font-heading text-body text-base font-medium tracking-wide hidden sm:block">
            THE ELEVATED STAG
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 lg:px-3 py-3">
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-3 font-body text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Client
        </Link>

        <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-heading text-xl font-medium text-body">Edit Purchase</h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 font-body text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-3 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Category */}
            <div>
              <label className="block font-body text-sm font-medium text-gray-dark mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`px-4 py-2 rounded font-body text-sm font-semibold transition-colors ${
                      formData.category === cat.value
                        ? 'bg-body text-white'
                        : 'bg-gray-light text-gray-dark hover:bg-gray-med'
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
                <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                Description / Color
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
              />
            </div>

            {/* Size, Quantity, Price */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                  Size
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-gray-dark mb-1">
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
                    className="w-full pl-8 pr-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block font-body text-sm font-medium text-gray-dark mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-med rounded font-body focus:outline-none focus:border-gold"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link
                href={`/clients/${clientId}`}
                className="flex-1 px-3 py-3 border border-gray-med rounded font-body font-semibold text-gray-dark text-center hover:bg-gray-light transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-body hover:bg-body-hover disabled:bg-gray-med text-white px-3 py-3 rounded font-body font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Update Purchase
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
