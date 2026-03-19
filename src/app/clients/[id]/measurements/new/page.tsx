'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLog'

// Measurement fields by category (based on Trinity's structure)
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

export default function NewMeasurementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>('coat')
  const [measurements, setMeasurements] = useState<Record<string, string>>({})

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }))
  }

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory)
    setMeasurements({}) // Reset measurements when category changes
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Filter out empty measurements
    const filledMeasurements = Object.fromEntries(
      Object.entries(measurements).filter(([_, value]) => value.trim() !== '')
    )

    if (Object.keys(filledMeasurements).length === 0) {
      setError('Please enter at least one measurement.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('measurements')
      .insert({
        client_id: clientId,
        category,
        measurements: filledMeasurements,
        source: 'manual',
      })

    if (insertError) {
      console.error('Error saving measurements:', insertError)
      setError('Failed to save measurements. Please try again.')
      setSaving(false)
      return
    }

    // Log activity
    await logActivity({
      clientId: clientId,
      activityType: 'measurement_added',
      title: `${category.charAt(0).toUpperCase() + category.slice(1)} measurements added`,
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
          <h1 className="font-heading text-xl font-medium text-[#2D2D2D] mb-6">Add Measurements</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block font-body text-sm font-medium text-[#8A8A8A] mb-2">
                Garment Category
              </label>
              <div className="flex gap-2">
                {(Object.keys(measurementFields) as Category[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-4 py-2 rounded-xl font-body text-sm font-semibold capitalize transition-colors ${
                      category === cat
                        ? 'bg-[#2D2D2D] text-white'
                        : 'bg-gray-light text-[#8A8A8A] hover:bg-[#F0EEEB]'
                    }`}
                  >
                    {cat}
                  </button>
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

            <p className="font-body text-sm text-gray-dark">
              Tip: Enter measurements with fractions like "42 1/2" or decimals like "42.5"
            </p>

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
                    Save Measurements
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
