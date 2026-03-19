'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Field definitions per category
// ---------------------------------------------------------------------------

interface Field {
  key: string
  label: string
  fraction?: boolean
}

const BODY_FIELDS: Field[] = [
  { key: 'height', label: 'Height', fraction: true },
  { key: 'weight', label: 'Weight' },
  { key: 'coat_fit', label: 'Coat Fit' },
  { key: 'pant_fit', label: 'Pant Fit' },
  { key: 'shoulder_reading', label: 'Shoulder Reading' },
]

const COAT_FIELDS: Field[] = [
  { key: 'point_to_point', label: 'Point to Point', fraction: true },
  { key: 'overarm', label: 'Overarm', fraction: true },
  { key: 'chest', label: 'Chest', fraction: true },
  { key: 'half_back', label: 'Half Back', fraction: true },
  { key: 'coat_waist', label: 'Coat Waist', fraction: true },
  { key: 'coat_seat', label: 'Coat Seat', fraction: true },
  { key: 'half_girth', label: 'Half Girth', fraction: true },
  { key: 'coat_length', label: 'Coat Length', fraction: true },
  { key: 'coat_sleeve_left', label: 'Coat Sleeve (L)', fraction: true },
  { key: 'coat_sleeve_right', label: 'Coat Sleeve (R)', fraction: true },
  { key: 'top_button_position', label: 'Top Button Position', fraction: true },
]

const PANT_FIELDS: Field[] = [
  { key: 'skin_waist', label: 'Skin Waist', fraction: true },
  { key: 'skin_seat', label: 'Skin Seat', fraction: true },
  { key: 'rise', label: 'Rise', fraction: true },
  { key: 'pant_inseam_left', label: 'Pant Inseam (L)', fraction: true },
  { key: 'pant_inseam_right', label: 'Pant Inseam (R)', fraction: true },
  { key: 'pant_outseam_left', label: 'Pant Outseam (L)', fraction: true },
  { key: 'pant_outseam_right', label: 'Pant Outseam (R)', fraction: true },
  { key: 'skin_thigh', label: 'Skin Thigh', fraction: true },
  { key: 'knee', label: 'Knee', fraction: true },
  { key: 'bottom', label: 'Bottom', fraction: true },
]

const SHIRT_FIELDS: Field[] = [
  { key: 'finished_collar', label: 'Finished Collar', fraction: true },
  { key: 'finished_yoke', label: 'Finished Yoke', fraction: true },
  { key: 'actual_chest', label: 'Actual Chest', fraction: true },
  { key: 'chest_fit', label: 'Chest Fit', fraction: true },
  { key: 'actual_waist', label: 'Actual Waist', fraction: true },
  { key: 'waist_fit', label: 'Waist Fit', fraction: true },
  { key: 'actual_hips', label: 'Actual Hips', fraction: true },
  { key: 'hips_fit', label: 'Hips Fit', fraction: true },
  { key: 'armhole_sleeve_fit', label: 'Armhole / Sleeve Fit', fraction: true },
  { key: 'finished_sleeve_left', label: 'Finished Sleeve (L)', fraction: true },
  { key: 'finished_sleeve_right', label: 'Finished Sleeve (R)', fraction: true },
  { key: 'finished_cuff_left', label: 'Finished Cuff (L)', fraction: true },
  { key: 'finished_cuff_right', label: 'Finished Cuff (R)', fraction: true },
]

// All categories that get persisted
const ALL_CATEGORIES = [
  { category: 'body', fields: BODY_FIELDS },
  { category: 'coat', fields: COAT_FIELDS },
  { category: 'pant', fields: PANT_FIELDS },
  { category: 'shirt', fields: SHIRT_FIELDS },
]

// Key measurements that appear in the highlight box (category.key references)
const KEY_MEASUREMENTS: { category: string; key: string; label: string }[] = [
  { category: 'shirt', key: 'finished_collar', label: 'Finished Neck' },
  { category: 'coat', key: 'chest', label: 'Chest' },
  { category: 'coat', key: 'coat_waist', label: 'Coat Waist' },
  { category: 'pant', key: 'skin_waist', label: 'Waist' },
  { category: 'pant', key: 'skin_seat', label: 'Seat' },
]

const FRACTIONS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MeasurementValue = { whole: string; fraction: string }
type MeasurementsState = Record<string, Record<string, MeasurementValue>>

function parseValue(raw: string): MeasurementValue {
  const str = String(raw).trim()
  const match = str.match(/^(\d+)?\s*(\d\/\d)?$/)
  if (match) {
    return { whole: match[1] || '', fraction: match[2] || '' }
  }
  return { whole: str, fraction: '' }
}

function combineValue(v: MeasurementValue): string {
  if (v.fraction) return `${v.whole} ${v.fraction}`.trim()
  return v.whole
}

function displayValue(v: MeasurementValue | undefined): string {
  if (!v) return '--'
  const combined = combineValue(v)
  return combined || '--'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MeasurementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<{ first_name: string; last_name: string } | null>(null)
  const [measurements, setMeasurements] = useState<MeasurementsState>({})
  const [fittingNotes, setFittingNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // ---- Data fetching ----
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const { data: clientData } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('id', id)
        .single()

      setClient(clientData)

      const { data: measurementData } = await supabase
        .from('measurements')
        .select('*')
        .eq('client_id', id)

      // Build initial empty state
      const initial: MeasurementsState = {}
      ALL_CATEGORIES.forEach(({ category, fields }) => {
        initial[category] = {}
        fields.forEach((f) => {
          initial[category][f.key] = { whole: '', fraction: '' }
        })
      })

      // Populate from DB
      if (measurementData) {
        measurementData.forEach((row) => {
          if (row.category === 'notes' && row.measurements) {
            setFittingNotes((row.measurements as Record<string, string>).fitting_notes || '')
            return
          }
          if (row.measurements && initial[row.category]) {
            Object.entries(row.measurements as Record<string, string>).forEach(([key, value]) => {
              if (initial[row.category][key]) {
                initial[row.category][key] = parseValue(value)
              }
            })
          }
        })
      }

      setMeasurements(initial)
      setLoading(false)
    }

    fetchData()
  }, [id])

  // ---- State updaters ----
  function updateMeasurement(category: string, field: string, type: 'whole' | 'fraction', value: string) {
    setMeasurements((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: {
          ...prev[category][field],
          [type]: value,
        },
      },
    }))
  }

  // ---- Save ----
  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      // Save each measurement category
      for (const { category, fields } of ALL_CATEGORIES) {
        const vals: Record<string, string> = {}
        let hasValues = false

        fields.forEach((f) => {
          const v = measurements[category]?.[f.key]
          if (v && (v.whole || v.fraction)) {
            hasValues = true
            vals[f.key] = combineValue(v)
          }
        })

        if (hasValues) {
          const { data: existing } = await supabase
            .from('measurements')
            .select('id')
            .eq('client_id', id)
            .eq('category', category)
            .single()

          if (existing) {
            await supabase
              .from('measurements')
              .update({ measurements: vals, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            await supabase.from('measurements').insert({
              client_id: id,
              category,
              measurements: vals,
              source: 'manual',
            })
          }
        }
      }

      // Save fitting notes
      if (fittingNotes.trim()) {
        const { data: existing } = await supabase
          .from('measurements')
          .select('id')
          .eq('client_id', id)
          .eq('category', 'notes')
          .single()

        const notesPayload = { fitting_notes: fittingNotes }

        if (existing) {
          await supabase
            .from('measurements')
            .update({ measurements: notesPayload, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('measurements').insert({
            client_id: id,
            category: 'notes',
            measurements: notesPayload,
            source: 'manual',
          })
        }
      }

      setLastSaved(new Date())
    } catch (err) {
      console.error('Error saving measurements:', err)
    } finally {
      setSaving(false)
    }
  }

  // ---- Reusable input row ----
  function MeasurementInput({ category, field }: { category: string; field: Field }) {
    const v = measurements[category]?.[field.key]
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <label className="font-body text-sm text-gray-dark whitespace-nowrap">{field.label}</label>
        <div className="flex gap-1.5">
          <input
            type="number"
            value={v?.whole || ''}
            onChange={(e) => updateMeasurement(category, field.key, 'whole', e.target.value)}
            placeholder="0"
            className="w-16 px-2 py-1.5 border border-[#F0EEEB] rounded-md font-body text-sm focus:outline-none focus:border-[#2D2D2D] text-center"
          />
          {field.fraction !== false && (
            <select
              value={v?.fraction || ''}
              onChange={(e) => updateMeasurement(category, field.key, 'fraction', e.target.value)}
              className="w-[4.5rem] px-1 py-1.5 border border-[#F0EEEB] rounded-md font-body text-sm focus:outline-none focus:border-[#2D2D2D] bg-white"
            >
              {FRACTIONS.map((f) => (
                <option key={f} value={f}>
                  {f || '\u2014'}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    )
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <Layout currentPage="clients">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
        </div>
      </Layout>
    )
  }

  // ---- Render ----
  return (
    <Layout currentPage="clients">
      <div className="max-w-7xl">
        {/* Back link */}
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#2D2D2D] mb-6 font-body text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {client?.first_name} {client?.last_name}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Measurements</h1>
            <p className="font-body text-gray-dark">
              {client?.first_name} {client?.last_name} &mdash; At a Glance
            </p>
          </div>

          <div className="flex items-center gap-4">
            {lastSaved && (
              <span className="font-body text-sm text-gray-dark">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2D2D2D] hover:bg-[#404040] disabled:bg-gray-med text-white px-5 py-2.5 rounded-xl font-body font-medium text-sm flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save All Measurements
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* KEY MEASUREMENTS highlight box                                   */}
        {/* ================================================================ */}
        <div className="bg-gray-light border border-[#F0EEEB] rounded-2xl mb-8 px-8 py-6">
          <h2 className="font-heading text-sm font-medium text-[#2D2D2D] uppercase tracking-wider mb-4">
            Key Measurements
          </h2>
          <div className="flex flex-wrap gap-4 sm:gap-8">
            {KEY_MEASUREMENTS.map((km) => (
              <div key={`${km.category}-${km.key}`} className="text-center min-w-[100px]">
                <p className="font-body text-xs text-gray-dark mb-1">{km.label}</p>
                <p className="font-heading text-2xl font-medium text-[#2D2D2D]">
                  {displayValue(measurements[km.category]?.[km.key])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Three-column layout: Body | Coat | Pant                          */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* --- Left column: Body Description --- */}
          <div className="bg-white rounded-2xl border border-gray-med p-5" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <h3 className="font-heading text-base font-medium text-[#2D2D2D] mb-4 border-b border-gray-med pb-2">
              Body Description
            </h3>
            <div className="space-y-1">
              {BODY_FIELDS.map((field) => (
                <MeasurementInput key={field.key} category="body" field={field} />
              ))}
            </div>
          </div>

          {/* --- Center column: Coat Measurements --- */}
          <div className="bg-white rounded-2xl border border-gray-med p-5" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <h3 className="font-heading text-base font-medium text-[#2D2D2D] mb-4 border-b border-gray-med pb-2">
              Coat Measurements
            </h3>
            <div className="space-y-1">
              {COAT_FIELDS.map((field) => (
                <MeasurementInput key={field.key} category="coat" field={field} />
              ))}
            </div>
          </div>

          {/* --- Right column: Pant Measurements --- */}
          <div className="bg-white rounded-2xl border border-gray-med p-5" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <h3 className="font-heading text-base font-medium text-[#2D2D2D] mb-4 border-b border-gray-med pb-2">
              Pant Measurements
            </h3>
            <div className="space-y-1">
              {PANT_FIELDS.map((field) => (
                <MeasurementInput key={field.key} category="pant" field={field} />
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Shirt Measurements                                               */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl border border-gray-med p-5 mb-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h3 className="font-heading text-base font-medium text-[#2D2D2D] mb-4 border-b border-gray-med pb-2">
            Shirt Measurements
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-1">
            {SHIRT_FIELDS.map((field) => (
              <MeasurementInput key={field.key} category="shirt" field={field} />
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Fitting Notes                                                    */}
        {/* ================================================================ */}
        <div className="bg-white rounded-2xl border border-gray-med p-5 mb-8" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <h3 className="font-heading text-base font-medium text-[#2D2D2D] mb-4 border-b border-gray-med pb-2">
            Fitting Notes
          </h3>
          <textarea
            value={fittingNotes}
            onChange={(e) => setFittingNotes(e.target.value)}
            rows={6}
            placeholder="Add any fitting notes, alterations, preferences, or special instructions..."
            className="w-full px-4 py-3 border border-[#F0EEEB] rounded-xl font-body text-sm focus:outline-none focus:border-[#2D2D2D] resize-y"
          />
        </div>
      </div>
    </Layout>
  )
}
