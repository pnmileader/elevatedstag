'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import CareItemForm, { type CareItemValues } from '@/components/CareItemForm'
import {
  THANK_YOU_TYPE,
  careLabel,
  formatDueDate,
  isOverdue,
  latestThankYouNote,
  listableCareItems,
} from '@/lib/careItems'

type CareItem = {
  id: string
  client_id: string
  item_type: string
  title: string
  completed: boolean
  completed_at: string | null
  due_date: string | null
  created_at?: string | null
}

type CareItemsCardProps = {
  clientId: string
  initialItems: CareItem[]
}

export default function CareItemsCard({ clientId, initialItems }: CareItemsCardProps) {
  const [items, setItems] = useState<CareItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const [savingThankYou, setSavingThankYou] = useState(false)

  const thankYou = latestThankYouNote(items)

  // The fixed Thank You Note line: checking it records the note as sent (creating the
  // item the first time); unchecking it reopens the same item.
  const handleThankYouToggle = async () => {
    setSavingThankYou(true)
    const supabase = createClient()
    const nowIso = new Date().toISOString()

    if (thankYou) {
      const newCompleted = !thankYou.completed
      const completed_at = newCompleted ? nowIso : null
      const { error } = await supabase
        .from('client_care_items')
        .update({ completed: newCompleted, completed_at })
        .eq('id', thankYou.id)
      if (!error) {
        setItems((prev) => prev.map((i) => (i.id === thankYou.id ? { ...i, completed: newCompleted, completed_at } : i)))
      }
    } else {
      const { data, error } = await supabase
        .from('client_care_items')
        .insert({
          client_id: clientId,
          item_type: THANK_YOU_TYPE,
          title: 'Thank You Note',
          completed: true,
          completed_at: nowIso,
        })
        .select()
        .single()
      if (!error && data) setItems((prev) => [...prev, data])
    }
    setSavingThankYou(false)
  }

  const handleToggle = async (item: CareItem) => {
    setTogglingId(item.id)
    const supabase = createClient()

    const newCompleted = !item.completed
    const { error } = await supabase
      .from('client_care_items')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (!error) {
      setItems(items.map(i =>
        i.id === item.id
          ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : i
      ))
    }
    setTogglingId(null)
  }

  const handleAddItem = async (values: CareItemValues) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_care_items')
      .insert({
        client_id: clientId,
        title: values.title,
        item_type: values.item_type,
        due_date: values.due_date || null,
        completed: false,
      })
      .select()
      .single()

    if (!error && data) {
      setItems((prev) => [...prev, data])
      setShowForm(false)
    }
  }

  const handleDeleteConfirm = async (itemId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('client_care_items')
      .delete()
      .eq('id', itemId)

    if (!error) {
      setItems(items.filter(i => i.id !== itemId))
    }
    setConfirmingDeleteId(null)
  }

  // Sort: incomplete first (by due date), then completed. Due dates are YYYY-MM-DD, so they sort as text.
  const sortedItems = listableCareItems(items).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  return (
    <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm font-medium text-body">Client Care</h2>
        {/* 44px tap target: this was a bare 20px-tall text button, nearly impossible to hit on a phone */}
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
          data-testid="care-add-item"
          className="min-h-[44px] min-w-[44px] -mr-2 px-3 rounded text-gray-dark hover:text-body active:bg-gray-light font-body text-sm font-medium flex items-center gap-1 touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add Item Form */}
      {showForm && (
        <div className="mb-4">
          <CareItemForm submitLabel="Add" onSubmit={handleAddItem} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Fixed Thank You Note line */}
      <div className="flex items-center gap-4 p-4 rounded hover:bg-gray-light" data-testid="care-thank-you">
        <button
          type="button"
          onClick={handleThankYouToggle}
          disabled={savingThankYou}
          role="checkbox"
          aria-checked={!!thankYou?.completed}
          aria-label={thankYou?.completed ? 'Thank You Note sent — tap to mark as not sent' : 'Mark Thank You Note as sent'}
          data-testid="care-thank-you-toggle"
          className="w-[44px] h-[44px] -m-3 flex items-center justify-center flex-shrink-0 touch-manipulation"
        >
          <CheckSquare checked={!!thankYou?.completed} busy={savingThankYou} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm font-semibold leading-relaxed">Thank You Note</p>
          <p className="font-body text-xs text-gray-dark mt-1" data-testid="care-thank-you-status">
            {thankYou?.completed && thankYou.completed_at
              ? `Sent ${new Date(thankYou.completed_at).toLocaleDateString()}`
              : 'Not sent yet'}
          </p>
        </div>
      </div>

      {/* Care Items List */}
      {sortedItems.length === 0 ? (
        <p className="text-gray-dark font-body text-sm px-4 pt-2">No to-dos or follow-ups yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <CareItemRow
              key={item.id}
              item={item}
              toggling={togglingId === item.id}
              onToggle={() => handleToggle(item)}
              confirmingDelete={confirmingDeleteId === item.id}
              onDeleteRequest={() => setConfirmingDeleteId(item.id)}
              onDeleteConfirm={() => handleDeleteConfirm(item.id)}
              onDeleteCancel={() => setConfirmingDeleteId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CareItemRow({
  item,
  toggling,
  onToggle,
  confirmingDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel
}: {
  item: CareItem
  toggling: boolean
  onToggle: () => void
  confirmingDelete: boolean
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const overdue = isOverdue(item)
  const label = careLabel(item.item_type)

  return (
    <div className={`flex items-center gap-4 p-4 rounded group ${overdue ? 'bg-red-50' : 'hover:bg-gray-light'}`}>
      <button
        onClick={onToggle}
        disabled={toggling}
        role="checkbox"
        aria-checked={item.completed}
        aria-labelledby={`care-title-${item.id}`}
        aria-label={`Mark "${item.title}" as ${item.completed ? 'incomplete' : 'complete'}`}
        className="w-[44px] h-[44px] -m-3 flex items-center justify-center flex-shrink-0 touch-manipulation"
      >
        <CheckSquare checked={item.completed} busy={toggling} />
      </button>

      <div className="flex-1 min-w-0">
        <p id={`care-title-${item.id}`} className={`font-body text-sm leading-relaxed ${item.completed ? 'line-through text-gray-dark' : ''}`}>
          <span className="font-semibold">{label}:</span> {item.title}
        </p>
        {item.due_date && !item.completed && (
          <p className={`font-body text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-dark'}`}>
            Due: {formatDueDate(item.due_date)}
          </p>
        )}
        {item.completed_at && (
          <p className="font-body text-xs text-gray-dark mt-1">
            Completed: {new Date(item.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {confirmingDelete ? (
        <span role="alertdialog" aria-label="Confirm deletion" className="flex items-center gap-1 font-body text-xs text-gray-dark">
          Delete?
          <button
            onClick={onDeleteConfirm}
            className="min-h-[44px] px-3 text-red-600 hover:text-red-700 font-medium"
            aria-label={`Confirm delete "${item.title}"`}
          >
            Yes
          </button>
          <button
            onClick={onDeleteCancel}
            className="min-h-[44px] px-3 text-gray-dark hover:text-body font-medium"
            aria-label="Cancel delete"
          >
            No
          </button>
        </span>
      ) : (
        <button
          onClick={onDeleteRequest}
          aria-label={`Delete "${item.title}"`}
          className="w-[44px] h-[44px] -mr-3 flex items-center justify-center text-ink-muted focus-visible:text-error active:text-error transition-colors touch-manipulation"
        >
          <span className="text-xs">&#10005;</span>
        </button>
      )}
    </div>
  )
}

function CheckSquare({ checked, busy }: { checked: boolean; busy: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-gold border-gold' : 'border-gray-med'
      }`}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin text-gold" />
      ) : checked ? (
        <span className="text-white text-xs">&#10003;</span>
      ) : null}
    </span>
  )
}
