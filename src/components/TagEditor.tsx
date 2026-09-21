'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { addTag, removeTag } from '@/lib/clientFilters'

type Props = {
  tags: string[]
  /** Every tag already used somewhere, for autocomplete. */
  suggestions: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

/** Tags as chips: type to add (with autocomplete from existing tags), tap × to remove. */
export default function TagEditor({ tags, suggestions, onChange, disabled }: Props) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const options = useMemo(() => {
    const q = draft.trim().toLowerCase()
    const have = new Set(tags.map((t) => t.toLowerCase()))
    return suggestions.filter((s) => !have.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 8)
  }, [draft, suggestions, tags])

  function commit(raw: string) {
    const next = addTag(tags, raw)
    if (next !== tags) onChange(next)
    setDraft('')
  }

  return (
    <div data-testid="tag-editor">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span key={tag} className="es-tag" data-testid="tag-chip">
            {tag}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              data-testid="tag-remove"
              onClick={() => onChange(removeTag(tags, tag))}
              className="es-tag-remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <div className="relative flex-1" style={{ minWidth: 150 }}>
          <input
            type="text"
            value={draft}
            disabled={disabled}
            data-testid="tag-input"
            aria-label="Add a tag"
            placeholder={tags.length ? 'Add tag…' : 'Add a tag (e.g. VP, San Antonio)…'}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                if (draft.trim()) commit(draft)
              } else if (e.key === 'Backspace' && !draft && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
            className="es-input"
          />
          {focused && options.length > 0 && (
            <ul
              className="t-dropdown-mount absolute left-0 right-0 top-full mt-1 z-30 bg-surface border border-rule rounded overflow-hidden"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
              data-testid="tag-suggestions"
            >
              {options.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    // mousedown fires before the input's blur, so the pick isn't lost
                    onMouseDown={(e) => { e.preventDefault(); commit(opt) }}
                    className="w-full min-h-[44px] px-4 text-left text-sm border-b border-rule last:border-b-0 active:bg-surface-alt"
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
