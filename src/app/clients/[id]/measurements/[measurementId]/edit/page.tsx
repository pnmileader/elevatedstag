'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const measurementFields = {
  coat: [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'length', label: 'Length' },
    { key: 'sleeve', label: 'Sleeve' },
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'half_girth', label: 'Half Girth' },
    { key: 'half_back', label: 'Half Back' },
    { key: 'point_to_point', label: 'Point to Point' },
  ],
  vest: [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'length', label: 'Length' },
    { key: 'front_length', label: 'Front Length' },
  ],
  pant: [
    { key: 'waist', label: 'Waist' },
    { key: 'outseam', label: 'Outseam' },
    { key: 'inseam', label: 'Inseam' },
    { key: 'thigh', label: 'Thigh' },
    { key: 'knee', label: 'Knee' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'rise', label: 'Rise' },
  ],
  shirt: [
    { key: 'neck', label: 'Neck' },
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'sleeve', label: 'Sleeve' },
    { key: 'yoke', label: 'Yoke' },
    { key: 'shirt_length', label: 'Shirt Length' },
  ],
}

type Category = keyof typeof measurementFields

export default function EditMeasurementsPage({ params }: { params: Promise<{ id: string; measurementId: string }> }) {
  const { id: clientId, measurementId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>('coat')
  const [measurements, setMeasurements] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadMeasurement() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('id', measurementId)
        .single()

      if (error || !data) {
        setError('Measurement not found')
        setLoading(false)
        return
      }

      setCategory(data.category as Category)
      setMeasurements(data.measurements || {})
      setLoading(false)
    }

    loadMeasurement()
  }, [measurementId])

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const filledMeasurements = Object.fromEntries(
      Object.entries(measurements).filter(([_, value]) => value.trim() !== '')
    )

    if (Object.keys(filledMeasurements).length === 0) {
      setError('Please enter at least one measurement.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('measurements')
      .update({
        category,
        measurements: filledMeasurements,
      })
      .eq('id', measurementId)

    if (updateError) {
      console.error('Error updating measurements:', updateError)
      setError('Failed to update measurements. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/clients/${clientId}`)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete these measurements? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('measurements')
      .delete()
      .eq('id', measurementId)

    if (deleteError) {
      console.error('Error deleting measurements:', deleteError)
      setError('Failed to delete measurements. Please try again.')
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
            <h1 className="font-heading text-xl font-medium text-[#2D2D2D]">Edit Measurements</h1>
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Display (read-only for now) */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-2">
                Garment Category
              </label>
              <div className="flex gap-2">
                {(Object.keys(measurementFields) as Category[]).map((cat) => (
                  <span
                    key={cat}
                    className={`px-4 py-2 rounded-xl font-body text-sm font-semibold capitalize ${
                      category === cat
                        ? 'bg-[#2D2D2D] text-white'
                        : 'bg-gray-light text-[#8A8A8A]'
                    }`}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Measurement Fields */}
            <div className="grid grid-cols-2 gap-4">
              {measurementFields[category].map((field) => (
                <div key={field.key}>
                  <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-1">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={measurements[field.key] || ''}
                    onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                    className="w-full px-4 py-2 border border-[#F0EEEB] rounded-xl font-body focus:outline-none focus:border-gold"
                    placeholder='e.g., 42 1/2"'
                  />
                </div>
              ))}
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
                    Update Measurements
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
