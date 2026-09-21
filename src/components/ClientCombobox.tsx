'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clientDisplayName } from '@/lib/clientDisplay'
import { matchesSearch } from '@/lib/clientFilters'

export type ComboClient = {
  id: string
  first_name: string | null
  last_name: string | null
  email?: string | null
}

type Props = {
  clients: ComboClient[]
  value: string
  onChange: (clientId: string, client: ComboClient | null) => void
  placeholder?: string
  testId?: string
  /** Hide a client from the list (e.g. a client cannot refer themselves). */
  excludeId?: string
  id?: string
}

const MAX_VISIBLE = 50

/**
 * Searchable client picker. Replaces a native <select> of 650+ names, where the
 * only way to "search" was jumping by first letter and scrolling.
 */
export default function ClientCombobox({ clients, value, onChange, placeholder = 'Type a client name…', testId = 'client-selector', excludeId, id }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${testId}-listbox`

  const selected = useMemo(() => clients.find((c) => c.id === value) || null, [clients, value])

  const matches = useMemo(() => {
    const pool = excludeId ? clients.filter((c) => c.id !== excludeId) : clients
    return pool.filter((c) => matchesSearch(c, query)).slice(0, MAX_VISIBLE)
  }, [clients, query, excludeId])

  useEffect(() => {
    function outside(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [])

  function pick(client: ComboClient) {
    onChange(client.id, client)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) {
        e.preventDefault()
        pick(matches[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative" data-testid={testId}>
      {selected && !open ? (
        <div className="es-input flex items-center justify-between gap-2" style={{ paddingRight: 0 }}>
          <button
            type="button"
            className="flex-1 min-w-0 text-left truncate h-full"
            data-testid={`${testId}-selected`}
            onClick={() => {
              setOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <span className="font-semibold">{clientDisplayName(selected)}</span>
            {selected.email && <span className="text-ink-muted"> · {selected.email}</span>}
          </button>
          <button
            type="button"
            aria-label="Clear selected client"
            data-testid={`${testId}-clear`}
            onClick={() => onChange('', null)}
            className="w-[44px] h-[44px] flex items-center justify-center text-ink-muted flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid={`${testId}-input`}
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
              setOpen(true)
            }}
            onKeyDown={onKeyDown}
            className="es-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          data-testid={`${testId}-options`}
          className="t-dropdown-mount absolute left-0 right-0 top-full mt-1 z-40 bg-surface border border-rule rounded overflow-y-auto"
          style={{ maxHeight: 280, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-secondary">No clients match &ldquo;{query}&rdquo;</li>
          ) : (
            matches.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  data-testid={`${testId}-option`}
                  onClick={() => pick(c)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full min-h-[44px] px-4 py-2 text-left flex flex-col justify-center border-b border-rule last:border-b-0 ${i === highlight ? 'bg-surface-alt' : ''}`}
                >
                  <span className="text-sm font-semibold text-ink truncate">{clientDisplayName(c)}</span>
                  {c.email && <span className="text-xs text-ink-secondary truncate">{c.email}</span>}
                </button>
              </li>
            ))
          )}
          {matches.length === MAX_VISIBLE && (
            <li className="px-4 py-2 text-xs text-ink-muted">Showing the first {MAX_VISIBLE} — keep typing to narrow down.</li>
          )}
        </ul>
      )}
    </div>
  )
}
