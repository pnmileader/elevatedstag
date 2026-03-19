'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type CareItem = {
  id: string
  client_id: string
  item_type: string
  title: string
  completed: boolean
  completed_at: string | null
  due_date: string | null
}

type CareItemsCardProps = {
  clientId: string
  initialItems: CareItem[]
}

export default function CareItemsCard({ clientId, initialItems }: CareItemsCardProps) {
  const [items, setItems] = useState<CareItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [newItem, setNewItem] = useState({
    title: '',
    item_type: 'custom',
    due_date: '',
  })

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.title.trim()) return

    setSaving(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('client_care_items')
      .insert({
        client_id: clientId,
        title: newItem.title.trim(),
        item_type: newItem.item_type,
        due_date: newItem.due_date || null,
        completed: false,
      })
      .select()
      .single()

    if (!error && data) {
      setItems([...items, data])
      setNewItem({ title: '', item_type: 'custom', due_date: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Delete this care item?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('client_care_items')
      .delete()
      .eq('id', itemId)

    if (!error) {
      setItems(items.filter(i => i.id !== itemId))
    }
  }

  // Sort: incomplete first (by due date), then completed
  const sortedItems = [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  return (
    <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm font-medium text-[#2D2D2D]">Client Care</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[#8A8A8A] hover:text-[#2D2D2D] font-body text-sm font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add Item Form */}
      {showForm && (
        <form onSubmit={handleAddItem} className="mb-4 p-3 bg-gray-light rounded-lg">
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="e.g., Send thank you note"
                className="w-full px-3 py-2 border border-gray-med rounded-lg font-body text-sm focus:outline-none focus:border-gold"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newItem.item_type}
                onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                className="px-3 py-2 border border-gray-med rounded-lg font-body text-sm focus:outline-none focus:border-gold bg-white"
              >
                <option value="custom">Custom</option>
                <option value="thank_you_note">Thank You Note</option>
                <option value="follow_up_2week">2-Week Follow Up</option>
                <option value="follow_up_3month">3-Month Check-In</option>
              </select>
              <input
                type="date"
                value={newItem.due_date}
                onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })}
                className="px-3 py-2 border border-gray-med rounded-lg font-body text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-3 py-2 border border-gray-med rounded-lg font-body text-sm text-gray-dark hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newItem.title.trim()}
                className="flex-1 px-3 py-2 bg-[#2D2D2D] text-white rounded-xl font-body text-sm font-medium hover:bg-[#404040] disabled:bg-gray-med transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Care Items List */}
      {sortedItems.length === 0 ? (
        <p className="text-gray-dark font-body text-sm">No care items yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <CareItemRow
              key={item.id}
              item={item}
              toggling={togglingId === item.id}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id)}
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
  onDelete
}: {
  item: CareItem
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const isOverdue = item.due_date && !item.completed && new Date(item.due_date) < new Date()

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg group ${isOverdue ? 'bg-red-50' : 'hover:bg-gray-light'}`}>
      <button
        onClick={onToggle}
        disabled={toggling}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          item.completed
            ? 'bg-gold border-gold'
            : 'border-gray-med hover:border-gold'
        }`}
      >
        {toggling ? (
          <Loader2 className="w-3 h-3 animate-spin text-gold" />
        ) : item.completed ? (
          <span className="text-white text-xs">&#10003;</span>
        ) : null}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`font-body text-sm leading-relaxed ${item.completed ? 'line-through text-gray-dark' : ''}`}>
          {item.title}
        </p>
        {item.due_date && !item.completed && (
          <p className={`font-body text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-dark'}`}>
            Due: {new Date(item.due_date).toLocaleDateString()}
          </p>
        )}
        {item.completed_at && (
          <p className="font-body text-xs text-gray-dark mt-1">
            Completed: {new Date(item.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-dark hover:text-red-500 transition-opacity p-1"
      >
        <span className="text-xs">&#10005;</span>
      </button>
    </div>
  )
}
