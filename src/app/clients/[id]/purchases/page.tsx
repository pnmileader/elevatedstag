'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Plus, Loader2, ShoppingBag, X, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

interface Purchase {
  id: string
  category: string
  brand: string | null
  product_name: string
  description: string | null
  size: string | null
  price: number | null
  quantity: number
  purchase_date: string | null
  image_url: string | null
}

const CATEGORIES = [
  { value: 'shoes', label: 'Shoes', icon: '👞' },
  { value: 'jeans', label: 'Jeans', icon: '👖' },
  { value: 'belt', label: 'Belt', icon: '🎗️' },
  { value: 'accessories', label: 'Accessories', icon: '⌚' },
  { value: 'other', label: 'Other', icon: '📦' },
]

const COMMON_BRANDS = [
  'Magnanni',
  '34 Heritage',
  'Peter Millar',
  'Canali',
  'Zegna',
  'Allen Edmonds',
  'Cole Haan',
]

export default function PurchasesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<{ first_name: string; last_name: string } | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [category, setCategory] = useState('shoes')
  const [brand, setBrand] = useState('')
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [purchaseDate, setPurchaseDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    const supabase = createClient()

    const { data: clientData } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    setClient(clientData)

    const { data: purchasesData } = await supabase
      .from('ready_made_purchases')
      .select('*')
      .eq('client_id', id)
      .order('purchase_date', { ascending: false })

    setPurchases(purchasesData || [])
    setLoading(false)
  }

  function resetForm() {
    setCategory('shoes')
    setBrand('')
    setProductName('')
    setDescription('')
    setSize('')
    setPrice('')
    setQuantity('1')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setEditingPurchase(null)
  }

  function openNewForm() {
    resetForm()
    setShowForm(true)
  }

  function openEditForm(purchase: Purchase) {
    setEditingPurchase(purchase)
    setCategory(purchase.category)
    setBrand(purchase.brand || '')
    setProductName(purchase.product_name)
    setDescription(purchase.description || '')
    setSize(purchase.size || '')
    setPrice(purchase.price?.toString() || '')
    setQuantity(purchase.quantity?.toString() || '1')
    setPurchaseDate(purchase.purchase_date || '')
    setShowForm(true)
  }

  async function handleSave() {
    if (!productName.trim()) return

    setSaving(true)
    const supabase = createClient()

    const purchaseData = {
      client_id: id,
      category,
      brand: brand.trim() || null,
      product_name: productName.trim(),
      description: description.trim() || null,
      size: size.trim() || null,
      price: price ? parseFloat(price) : null,
      quantity: parseInt(quantity) || 1,
      purchase_date: purchaseDate || null,
    }

    if (editingPurchase) {
      await supabase
        .from('ready_made_purchases')
        .update(purchaseData)
        .eq('id', editingPurchase.id)
    } else {
      await supabase.from('ready_made_purchases').insert(purchaseData)

      // Log activity
      await supabase.from('activity_log').insert({
        client_id: id,
        activity_type: 'purchase_added',
        title: 'Ready-made purchase added',
        description: `${brand ? brand + ' ' : ''}${productName}${size ? ` (Size: ${size})` : ''}`,
      })

      // Update client's last_purchase_date
      await supabase
        .from('clients')
        .update({
          last_purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
          last_contact_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
    }

    setShowForm(false)
    resetForm()
    fetchData()
    setSaving(false)
  }

  async function handleDelete() {
    if (!editingPurchase || !confirm('Delete this purchase?')) return

    setDeleting(true)
    const supabase = createClient()

    await supabase
      .from('ready_made_purchases')
      .delete()
      .eq('id', editingPurchase.id)

    setShowForm(false)
    resetForm()
    fetchData()
    setDeleting(false)
  }

  function getCategoryInfo(cat: string) {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[4]
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
            <h1 className="font-heading text-lg font-medium text-body">Ready-Made Purchases</h1>
            <p className="font-body text-gray-dark">
              {client?.first_name} {client?.last_name} - Shoes, Jeans, Accessories
            </p>
          </div>

          <button
            onClick={openNewForm}
            className="bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
        </div>

        {/* Purchase Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-3 lg:p-3 border-b border-gray-med flex items-center justify-between">
                <h2 className="font-heading text-base font-medium text-body">
                  {editingPurchase ? 'Edit Purchase' : 'Add Ready-Made Purchase'}
                </h2>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="p-2 hover:bg-gray-light rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-2">
                {/* Category */}
                <div>
                  <label className="block font-body font-medium text-sm mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`px-3 py-2 rounded font-body text-sm flex items-center gap-2 transition-colors ${
                          category === cat.value
                            ? 'bg-body text-white'
                            : 'bg-gray-light hover:bg-gray-med text-gray-dark'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand and Product Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Brand</label>
                    <input
                      type="text"
                      list="brand-list"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g., Magnanni"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                    <datalist id="brand-list">
                      {COMMON_BRANDS.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Product Name *</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g., Oxford Dress Shoe"
                      required
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-body font-medium text-sm mb-2">Color / Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Black, Brown, Cherry"
                    className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                  />
                </div>

                {/* Size, Price, Quantity */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Size</label>
                    <input
                      type="text"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="e.g., 9.5 or 34x32"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Price</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="450.00"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                  <div>
                    <label className="block font-body font-medium text-sm mb-2">Qty</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                    />
                  </div>
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block font-body font-medium text-sm mb-2">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body"
                  />
                </div>
              </div>

              <div className="p-3 lg:p-3 border-t border-gray-med flex gap-3">
                {editingPurchase && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 rounded font-body text-sm flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-3 py-2 border border-gray-med rounded font-body font-medium text-gray-dark hover:border-body"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !productName.trim()}
                  className="px-3 py-2 bg-body hover:bg-body-hover disabled:bg-gray-med text-white rounded font-body font-medium flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingPurchase ? 'Update' : 'Add Purchase'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purchases List */}
        {purchases.length === 0 ? (
          <div className="bg-white rounded p-3 text-center border border-gray-med">
            <ShoppingBag className="w-12 h-12 text-gray-med mx-auto mb-4" />
            <p className="font-body text-gray-dark mb-4">No ready-made purchases yet</p>
            <button
              onClick={openNewForm}
              className="text-gray-dark hover:text-body font-body text-sm font-medium"
            >
              Add the first purchase →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map(purchase => {
              const catInfo = getCategoryInfo(purchase.category)

              return (
                <div
                  key={purchase.id}
                  onClick={() => openEditForm(purchase)}
                  className="bg-white rounded border border-gray-med p-5 hover:border-body transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {/* Category Icon */}
                    <div className="w-12 h-12 bg-gray-light rounded flex items-center justify-center text-lg flex-shrink-0">
                      {catInfo.icon}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-body font-medium">
                        {purchase.brand && <span className="text-gray-dark">{purchase.brand}</span>}
                        {purchase.brand && ' '}
                        {purchase.product_name}
                      </h3>
                      <p className="font-body text-sm text-gray-dark">
                        {[
                          purchase.description,
                          purchase.size && `Size: ${purchase.size}`,
                          purchase.quantity > 1 && `Qty: ${purchase.quantity}`,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>

                    {/* Price and Date */}
                    <div className="text-right flex-shrink-0">
                      {purchase.price && (
                        <p className="font-heading text-lg font-medium text-body">
                          ${purchase.price.toLocaleString()}
                        </p>
                      )}
                      {purchase.purchase_date && (
                        <p className="font-body text-xs text-gray-dark">
                          {new Date(purchase.purchase_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      )}
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
