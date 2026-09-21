'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import Accordion from '@/components/motion/Accordion'
import { SuccessCheck, useSuccessFlash } from '@/components/motion/SuccessCheck'
import { useToast } from '@/components/motion/Toast'

// ---------------------------------------------------------------------------
// Field definitions per category
// ---------------------------------------------------------------------------

interface Field {
  key: string
  label: string
  fraction?: boolean
  /** 'height' renders feet + inches boxes instead of whole + fraction */
  kind?: 'height'
}

const BODY_FIELDS: Field[] = [
  { key: 'height', label: 'Height', kind: 'height' },
  { key: 'weight', label: 'Weight', fraction: false },
  { key: 'coat_fit', label: 'Coat Fit' },
  { key: 'pant_fit', label: 'Pant Fit' },
  { key: 'incline', label: 'Incline', fraction: true },
  { key: 'shoulder_reading_left', label: 'Shoulder Reading (L)', fraction: true },
  { key: 'shoulder_reading_right', label: 'Shoulder Reading (R)', fraction: true },
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
  { category: 'body', key: 'height', label: 'Height' },
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

// Height is feet + inches, stored as 5' 9". For height, `whole` holds feet and
// `fraction` holds inches. Older rows stored a bare number ("5", "5 3/8", or
// total inches like "69") — read those sensibly rather than dropping them.
function parseHeight(raw: string): MeasurementValue {
  const str = String(raw).trim()
  const ftIn = str.match(/^(\d+)\s*'\s*(\d+)?\s*"?$/)
  if (ftIn) return { whole: ftIn[1], fraction: ftIn[2] || '' }
  const num = str.match(/^(\d+)/)
  if (!num) return { whole: '', fraction: '' }
  const n = parseInt(num[1], 10)
  if (n > 11) return { whole: String(Math.floor(n / 12)), fraction: String(n % 12) }
  return { whole: String(n), fraction: '' }
}

function combineHeight(v: MeasurementValue): string {
  if (!v.whole && !v.fraction) return ''
  return `${v.whole || '0'}' ${v.fraction || '0'}"`
}

function onlyDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, '').slice(0, maxLen)
}

function displayValue(v: MeasurementValue | undefined, kind?: 'height'): string {
  if (!v) return '--'
  const combined = kind === 'height' ? combineHeight(v) : combineValue(v)
  return combined || '--'
}

// ---------------------------------------------------------------------------
// Input row
//
// This MUST be a module-level component. It used to be declared inside
// MeasurementsPage, which gave React a brand-new component type on every
// render — so each keystroke unmounted and remounted the <input>, dropping
// focus (and the iOS keyboard) after a single digit.
// ---------------------------------------------------------------------------

const INPUT_CLASS =
  'h-[44px] px-2 border border-gray-med rounded-md font-body text-sm text-center bg-white focus:outline-none focus:border-gold'

function MeasurementInput({
  category,
  field,
  value,
  onChange,
}: {
  category: string
  field: Field
  value: MeasurementValue | undefined
  onChange: (category: string, field: string, type: 'whole' | 'fraction', value: string) => void
}) {
  const id = `${category}-${field.key}`

  if (field.kind === 'height') {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <label htmlFor={`${id}-feet`} className="font-body text-sm text-gray-dark whitespace-nowrap">{field.label}</label>
        <div className="flex items-center gap-1.5">
          <input
            id={`${id}-feet`}
            name="height_feet"
            data-field="height_feet"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Height feet"
            value={value?.whole || ''}
            onChange={(e) => {
              const n = onlyDigits(e.target.value, 1)
              onChange(category, field.key, 'whole', n && (Number(n) < 3 || Number(n) > 8) ? '' : n)
            }}
            placeholder="5"
            className={`${INPUT_CLASS} w-[48px]`}
          />
          <span className="font-body text-xs text-gray-dark">Feet</span>
          <input
            id={`${id}-inches`}
            name="height_inches"
            data-field="height_inches"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Height inches"
            value={value?.fraction || ''}
            onChange={(e) => {
              const n = onlyDigits(e.target.value, 2)
              onChange(category, field.key, 'fraction', n && Number(n) > 11 ? n.slice(0, 1) : n)
            }}
            placeholder="9"
            className={`${INPUT_CLASS} w-[48px]`}
          />
          <span className="font-body text-xs text-gray-dark">Inches</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <label htmlFor={id} className="font-body text-sm text-gray-dark">{field.label}</label>
      <div className="flex gap-1.5 flex-shrink-0">
        <input
          id={id}
          name={`${category}.${field.key}`}
          data-field={field.key}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value?.whole || ''}
          onChange={(e) => onChange(category, field.key, 'whole', onlyDigits(e.target.value, 3))}
          placeholder="0"
          className={`${INPUT_CLASS} w-16`}
        />
        {field.fraction !== false && (
          <select
            aria-label={`${field.label} fraction`}
            name={`${category}.${field.key}.fraction`}
            value={value?.fraction || ''}
            onChange={(e) => onChange(category, field.key, 'fraction', e.target.value)}
            className="h-[44px] w-[4.5rem] px-1 border border-gray-med rounded-md font-body text-sm focus:outline-none focus:border-gold bg-white"
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const toast = useToast()
  const [savedFlash, flashSaved] = useSuccessFlash()

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
              // Shoulder Reading used to be one box; carry an old value into (L).
              const targetKey = row.category === 'body' && key === 'shoulder_reading' ? 'shoulder_reading_left' : key
              if (initial[row.category][targetKey]) {
                initial[row.category][targetKey] =
                  row.category === 'body' && targetKey === 'height' ? parseHeight(value) : parseValue(value)
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
            vals[f.key] = f.kind === 'height' ? combineHeight(v) : combineValue(v)
          }
        })

        if (hasValues) {
          const { data: existing } = await supabase
            .from('measurements')
            .select('id')
            .eq('client_id', id)
            .eq('category', category)
            .limit(1)
            .maybeSingle()

          const { error } = existing
            ? await supabase
                .from('measurements')
                .update({ measurements: vals, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            : await supabase.from('measurements').insert({
                client_id: id,
                category,
                measurements: vals,
                source: 'manual',
              })
          if (error) throw error
        }
      }

      // Save fitting notes
      if (fittingNotes.trim()) {
        const { data: existing } = await supabase
          .from('measurements')
          .select('id')
          .eq('client_id', id)
          .eq('category', 'notes')
          .limit(1)
          .maybeSingle()

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
      setSaveError(null)
      toast.success('Measurements saved')
      flashSaved()
    } catch (err) {
      console.error('Error saving measurements:', err)
      setSaveError('Could not save measurements. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <Layout currentPage="clients">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
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
          className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-3 font-body text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {client?.first_name} {client?.last_name}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Measurements</h1>
            <p className="font-body text-gray-dark">
              {client?.first_name} {client?.last_name} &mdash; At a Glance
            </p>
          </div>

          <div className="flex items-center gap-4">
            {saveError ? (
              <span role="alert" className="font-body text-sm text-error">{saveError}</span>
            ) : lastSaved && (
              <span className="font-body text-sm text-gray-dark" data-testid="measurements-saved">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              data-testid="save-measurements"
              className="bg-body hover:bg-body-hover disabled:bg-gray-med text-white px-5 min-h-[44px] rounded font-body font-medium text-sm flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : savedFlash ? (
                <>
                  <SuccessCheck show />
                  Saved
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
        <div className="bg-gray-light border border-gray-med rounded mb-3 px-3 py-3">
          <h2 className="font-heading text-sm font-medium text-body uppercase tracking-wider mb-4">
            Key Measurements
          </h2>
          <div className="flex flex-wrap gap-4 sm:gap-3">
            {KEY_MEASUREMENTS.map((km) => (
              <div key={`${km.category}-${km.key}`} className="text-center min-w-[100px]">
                <p className="font-body text-xs text-gray-dark mb-1">{km.label}</p>
                <p
                  className="font-heading text-lg font-medium text-body"
                  data-testid={km.key === 'height' ? 'height-display' : undefined}
                >
                  {displayValue(measurements[km.category]?.[km.key], km.key === 'height' ? 'height' : undefined)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Three-column layout: Body | Coat | Pant                          */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* --- Left column: Body Description --- */}
          <div className="bg-white rounded border border-gray-med p-5">
            <Accordion
              collapse="mobile"
              defaultOpen={true}
              testId="acc-body"
              title={<h3 className="font-heading text-base font-medium text-body">Body Description</h3>}
            >
            <div className="space-y-1 border-t border-gray-med mt-2 pt-3">
              {BODY_FIELDS.map((field) => (
                <MeasurementInput
                  key={field.key}
                  category="body"
                  field={field}
                  value={measurements.body?.[field.key]}
                  onChange={updateMeasurement}
                />
              ))}
            </div>
            </Accordion>
          </div>

          {/* --- Center column: Coat Measurements --- */}
          <div className="bg-white rounded border border-gray-med p-5">
            <Accordion
              collapse="mobile"
              defaultOpen={false}
              testId="acc-coat"
              title={<h3 className="font-heading text-base font-medium text-body">Coat Measurements</h3>}
            >
            <div className="space-y-1 border-t border-gray-med mt-2 pt-3">
              {COAT_FIELDS.map((field) => (
                <MeasurementInput
                  key={field.key}
                  category="coat"
                  field={field}
                  value={measurements.coat?.[field.key]}
                  onChange={updateMeasurement}
                />
              ))}
            </div>
            </Accordion>
          </div>

          {/* --- Right column: Pant Measurements --- */}
          <div className="bg-white rounded border border-gray-med p-5">
            <Accordion
              collapse="mobile"
              defaultOpen={false}
              testId="acc-pant"
              title={<h3 className="font-heading text-base font-medium text-body">Pant Measurements</h3>}
            >
            <div className="space-y-1 border-t border-gray-med mt-2 pt-3">
              {PANT_FIELDS.map((field) => (
                <MeasurementInput
                  key={field.key}
                  category="pant"
                  field={field}
                  value={measurements.pant?.[field.key]}
                  onChange={updateMeasurement}
                />
              ))}
            </div>
            </Accordion>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Shirt Measurements                                               */}
        {/* ================================================================ */}
        <div className="bg-white rounded border border-gray-med p-5 mb-3">
          <Accordion
            collapse="mobile"
            testId="acc-shirt"
            title={<h3 className="font-heading text-base font-medium text-body">Shirt Measurements</h3>}
          >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-1 border-t border-gray-med mt-2 pt-3">
            {SHIRT_FIELDS.map((field) => (
              <MeasurementInput
                  key={field.key}
                  category="shirt"
                  field={field}
                  value={measurements.shirt?.[field.key]}
                  onChange={updateMeasurement}
                />
            ))}
          </div>
          </Accordion>
        </div>

        {/* ================================================================ */}
        {/* Fitting Notes                                                    */}
        {/* ================================================================ */}
        <div className="bg-white rounded border border-gray-med p-5 mb-3">
          <h3 className="font-heading text-base font-medium text-body mb-4 border-b border-gray-med pb-2">
            Fitting Notes
          </h3>
          <textarea
            value={fittingNotes}
            onChange={(e) => setFittingNotes(e.target.value)}
            rows={6}
            placeholder="Add any fitting notes, alterations, preferences, or special instructions..."
            className="w-full px-4 py-3 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-body resize-y"
          />
        </div>
      </div>
    </Layout>
  )
}
