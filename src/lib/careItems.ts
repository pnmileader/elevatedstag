// Client Care helpers — kept out of the components so they can be unit tested.

import { parseDateOnly, formatDateOnly } from './dates'

export type CareItemLike = {
  id: string
  item_type: string | null
  title: string
  completed: boolean
  completed_at: string | null
  due_date: string | null // YYYY-MM-DD (a calendar day, no time zone)
  created_at?: string | null
}

/** What Katie picks from when adding an item. The Thank You Note has its own fixed line. */
export const CARE_TYPE_OPTIONS = [
  { value: 'to_do', label: 'To Do' },
  { value: 'follow_up', label: 'Follow Up' },
] as const

export const THANK_YOU_TYPE = 'thank_you_note'

/** Older items used Custom / 2-Week Follow Up / 3-Month Check-In; show them under the two current labels. */
export function careLabel(itemType: string | null | undefined): string {
  if (itemType === THANK_YOU_TYPE) return 'Thank You Note'
  if (itemType && itemType.startsWith('follow_up')) return 'Follow Up'
  return 'To Do'
}

export const parseLocalDate = parseDateOnly
export const formatDueDate = formatDateOnly

/** Overdue once the due day is over — not at 7pm the evening before. */
export function isOverdue(item: Pick<CareItemLike, 'due_date' | 'completed'>, now: Date = new Date()): boolean {
  if (item.completed) return false
  const due = parseLocalDate(item.due_date)
  if (!due) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return due < today
}

export function latestThankYouNote<T extends CareItemLike>(items: T[]): T | null {
  const notes = items.filter((i) => i.item_type === THANK_YOU_TYPE)
  if (notes.length === 0) return null
  return notes.reduce((a, b) => ((b.created_at ?? '') > (a.created_at ?? '') ? b : a))
}

/** Everything except thank-you notes, which live on their own fixed line. */
export function listableCareItems<T extends CareItemLike>(items: T[]): T[] {
  return items.filter((i) => i.item_type !== THANK_YOU_TYPE)
}
