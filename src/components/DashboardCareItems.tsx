'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatDueDate, groupCareItems, isOverdue } from '@/lib/careItems'
import CareItemForm, { type CareItemValues } from '@/components/CareItemForm'
import ConfirmModal from '@/components/ConfirmModal'
import { useToast } from '@/components/motion/Toast'
import type { ComboClient } from '@/components/ClientCombobox'

type Person = { id: string; first_name: string | null; last_name: string | null }

export type DashboardCareItem = {
  id: string
  item_type: string | null
  title: string
  completed: boolean
  completed_at: string | null
  due_date: string | null
  created_at?: string | null
  client_id: string | null
  client: Person | null
}

type Props = {
  initialItems: DashboardCareItem[]
  clients: ComboClient[]
}

const SELECT = 'id, item_type, title, completed, completed_at, due_date, created_at, client_id, client:clients(id, first_name, last_name)'

function normalise(row: Record<string, unknown>): DashboardCareItem {
  const c = row.client as Person | Person[] | null
  return { ...(row as unknown as DashboardCareItem), client: Array.isArray(c) ? c[0] ?? null : c ?? null }
}

/** Care Items Due on the dashboard: To Dos and Follow Ups, with add / edit / complete / delete. */
export default function DashboardCareItems({ initialItems, clients }: Props) {
  const [items, setItems] = useState<DashboardCareItem[]>(initialItems)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<DashboardCareItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const toast = useToast()
  const { toDos, followUps } = groupCareItems(items)

  function payload(values: CareItemValues) {
    return {
      item_type: values.item_type,
      title: values.title,
      due_date: values.due_date || null,
      client_id: values.client_id || null,
    }
  }

  async function handleAdd(values: CareItemValues) {
    const { data, error } = await createClient()
      .from('client_care_items')
      .insert({ ...payload(values), completed: false })
      .select(SELECT)
      .single()
    if (error || !data) {
      toast.error('Couldn’t add that item. Please try again.')
      return
    }
    setItems((prev) => [...prev, normalise(data)])
    setAdding(false)
    toast.success('Added')
  }

  async function handleEdit(id: string, values: CareItemValues) {
    const { data, error } = await createClient()
      .from('client_care_items')
      .update(payload(values))
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error || !data) {
      toast.error('Couldn’t save that change. Please try again.')
      return
    }
    setItems((prev) => prev.map((i) => (i.id === id ? normalise(data) : i)))
    setEditingId(null)
  }

  async function handleComplete(item: DashboardCareItem) {
    setTogglingId(item.id)
    const completed_at = new Date().toISOString()
    const { error } = await createClient()
      .from('client_care_items')
      .update({ completed: true, completed_at })
      .eq('id', item.id)
    setTogglingId(null)
    if (error) {
      toast.error('Couldn’t mark that done. Please try again.')
      return
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: true, completed_at } : i)))
    toast.success('Marked done')
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    const { error } = await createClient().from('client_care_items').delete().eq('id', deleting.id)
    setDeleteBusy(false)
    if (error) {
      toast.error('Couldn’t delete that item. Please try again.')
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== deleting.id))
    setDeleting(null)
  }

  return (
    <section data-testid="dash-care">
      <div className="es-section-header flex items-center justify-between">
        <span>Care Items Due</span>
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null) }}
          data-testid="dash-care-add"
          className="min-h-[44px] min-w-[44px] -my-3 -mr-2 px-2 inline-flex items-center gap-1 normal-case tracking-normal font-body text-sm font-medium text-gray-dark hover:text-body"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {adding && (
        <div className="px-[20px] py-3">
          <CareItemForm clients={clients} submitLabel="Add" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      <CareGroup
        title="To Dos"
        testId="dash-care-todos"
        items={toDos}
        clients={clients}
        editingId={editingId}
        togglingId={togglingId}
        onEdit={setEditingId}
        onSaveEdit={handleEdit}
        onComplete={handleComplete}
        onDelete={setDeleting}
      />
      <CareGroup
        title="Follow Ups"
        testId="dash-care-followups"
        items={followUps}
        clients={clients}
        editingId={editingId}
        togglingId={togglingId}
        onEdit={setEditingId}
        onSaveEdit={handleEdit}
        onComplete={handleComplete}
        onDelete={setDeleting}
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete this item?"
        message={deleting ? `“${deleting.title}” will be removed${deleting.client ? ` from ${deleting.client.first_name ?? ''} ${deleting.client.last_name ?? ''}`.trimEnd() : ''}.` : ''}
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

function CareGroup({
  title, testId, items, clients, editingId, togglingId, onEdit, onSaveEdit, onComplete, onDelete,
}: {
  title: string
  testId: string
  items: DashboardCareItem[]
  clients: ComboClient[]
  editingId: string | null
  togglingId: string | null
  onEdit: (id: string | null) => void
  onSaveEdit: (id: string, values: CareItemValues) => Promise<void>
  onComplete: (item: DashboardCareItem) => void
  onDelete: (item: DashboardCareItem) => void
}) {
  return (
    <div data-testid={testId}>
      <div role="heading" aria-level={3} className="font-sans text-[11px] uppercase tracking-[0.05em] font-semibold text-ink-muted px-[20px] pt-3 pb-1">
        {title} <span className="text-ink-secondary">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="font-body text-sm text-gray-dark px-[20px] py-2">Nothing open.</p>
      ) : (
        items.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="px-[20px] py-2">
              <CareItemForm
                clients={clients}
                initial={{ item_type: item.item_type ?? 'to_do', title: item.title, due_date: item.due_date ?? '', client_id: item.client_id ?? '' }}
                submitLabel="Save"
                onSubmit={(values) => onSaveEdit(item.id, values)}
                onCancel={() => onEdit(null)}
              />
            </div>
          ) : (
            <CareRow
              key={item.id}
              item={item}
              toggling={togglingId === item.id}
              onComplete={() => onComplete(item)}
              onEdit={() => onEdit(item.id)}
              onDelete={() => onDelete(item)}
            />
          ),
        )
      )}
    </div>
  )
}

function CareRow({ item, toggling, onComplete, onEdit, onDelete }: {
  item: DashboardCareItem
  toggling: boolean
  onComplete: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const overdue = isOverdue(item)
  const clientName = item.client ? `${item.client.first_name ?? ''} ${item.client.last_name ?? ''}`.trim() : ''
  return (
    <div className={`es-row gap-3 ${overdue ? 'bg-red-50' : ''}`} data-testid="dash-care-row">
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark "${item.title}" done`}
        onClick={onComplete}
        disabled={toggling}
        className="w-[44px] h-[44px] -m-2 flex items-center justify-center flex-shrink-0 touch-manipulation"
      >
        <span className="w-5 h-5 rounded border-2 border-gray-med flex items-center justify-center">
          {toggling && <Loader2 className="w-3 h-3 animate-spin text-gold" />}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{item.title}</div>
        {clientName && item.client_id && (
          <Link href={`/clients/${item.client_id}`} className="inline-flex items-center min-h-[44px] -my-3 text-ink-muted text-[12px] hover:underline">
            {clientName}
          </Link>
        )}
      </div>
      {item.due_date && (
        <div className={`flex-shrink-0 text-[13px] font-semibold ${overdue ? 'text-error' : 'text-ink-secondary'}`}>
          {overdue ? 'Overdue · ' : ''}{formatDueDate(item.due_date, { month: 'short', day: 'numeric' })}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit "${item.title}"`}
        data-testid="dash-care-edit"
        className="w-[44px] h-[44px] -my-2 flex items-center justify-center text-ink-muted hover:text-body flex-shrink-0"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete "${item.title}"`}
        data-testid="dash-care-delete"
        className="w-[44px] h-[44px] -my-2 -mr-2 flex items-center justify-center text-ink-muted hover:text-error flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
