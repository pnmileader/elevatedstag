'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import ClientCombobox, { type ComboClient } from '@/components/ClientCombobox'
import { CARE_TYPE_OPTIONS } from '@/lib/careItems'

export type CareItemValues = {
  item_type: string
  title: string
  due_date: string // '' when none
  client_id: string // '' when none
}

type Props = {
  initial?: Partial<CareItemValues>
  /** Pass the client list to show a client picker (dashboard); omit it on a client's own page. */
  clients?: ComboClient[]
  submitLabel: string
  onSubmit: (values: CareItemValues) => Promise<void>
  onCancel: () => void
}

/** Add / edit a To Do or Follow Up. Used on the client page and the dashboard. */
export default function CareItemForm({ initial, clients, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<CareItemValues>({
    item_type: initial?.item_type && CARE_TYPE_OPTIONS.some((o) => o.value === initial.item_type)
      ? initial.item_type
      : initial?.item_type?.startsWith('follow_up') ? 'follow_up' : 'to_do',
    title: initial?.title ?? '',
    due_date: initial?.due_date ?? '',
    client_id: initial?.client_id ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) return
    setSaving(true)
    try {
      await onSubmit({ ...values, title: values.title.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-gray-light rounded space-y-3" data-testid="care-form">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={values.item_type}
          onChange={(e) => setValues({ ...values, item_type: e.target.value })}
          aria-label="Type"
          data-testid="care-type-select"
          className="min-h-[44px] min-w-0 px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold bg-white"
        >
          {CARE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={values.due_date}
          onChange={(e) => setValues({ ...values, due_date: e.target.value })}
          aria-label="Due date"
          data-testid="care-due-input"
          className="min-h-[44px] min-w-0 px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold bg-white"
        />
      </div>
      <input
        type="text"
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        placeholder="Brief description, e.g. Needs shirts"
        aria-label="Description"
        data-testid="care-title-input"
        className="w-full min-h-[44px] px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold bg-white"
        autoFocus
      />
      {clients && (
        <ClientCombobox
          clients={clients}
          value={values.client_id}
          onChange={(clientId) => setValues({ ...values, client_id: clientId })}
          placeholder="Client (optional) — type a name…"
          testId="care-client"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[44px] px-3 py-2 border border-gray-med rounded font-body text-sm text-gray-dark hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !values.title.trim()}
          data-testid="care-save"
          className="flex-1 min-h-[44px] px-3 py-2 bg-body text-white rounded font-body text-sm font-medium hover:bg-body-hover disabled:bg-gray-med transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : submitLabel}
        </button>
      </div>
    </form>
  )
}
