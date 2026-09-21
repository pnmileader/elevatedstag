'use client'

import { useState, useEffect, useRef, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, ShoppingBag, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clientDisplayName, type DisplayClient } from '@/lib/clientDisplay'

type SearchResult = {
  type: 'client' | 'order'
  id: string
  clientId?: string
  title: string
  subtitle: string
}

type OrderHit = {
  id: string
  client_id: string
  garment_type: string | null
  fabric_name: string | null
  clients: DisplayClient | DisplayClient[] | null
}

type SearchBarProps = {
  /** Lets the parent focus the input synchronously inside a tap handler (iOS only opens the keyboard then). */
  inputRef?: RefObject<HTMLInputElement | null>
  onClose?: () => void
}

// PostgREST's or() filter uses commas/parens as syntax — strip them from user input.
function searchTokens(query: string): string[] {
  return query
    .replace(/[,()%*\\]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)
}

export default function SearchBar({ inputRef, onClose }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? localRef
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Debounced search (the empty-query reset happens in the change handler)
  useEffect(() => {
    const tokens = searchTokens(query)
    if (tokens.length === 0) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const searchResults: SearchResult[] = []

      // Clients: every token must match one of the name/contact columns,
      // so "James Bett" finds James Bettersworth.
      let clientQuery = supabase.from('clients').select('id, first_name, last_name, email, phone')
      for (const t of tokens) {
        clientQuery = clientQuery.or(
          `first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`,
        )
      }
      const { data: clients } = await clientQuery.order('last_name').limit(8)

      clients?.forEach((client) => {
        searchResults.push({
          type: 'client',
          id: client.id,
          title: clientDisplayName(client),
          subtitle: client.email || client.phone || 'No contact info',
        })
      })

      // Orders by fabric or garment
      let orderQuery = supabase
        .from('custom_orders')
        .select('id, client_id, garment_type, fabric_name, clients(first_name, last_name)')
      for (const t of tokens) {
        orderQuery = orderQuery.or(`fabric_name.ilike.%${t}%,garment_type.ilike.%${t}%`)
      }
      const { data: orders } = await orderQuery.order('order_date', { ascending: false }).limit(5)

      ;(orders as OrderHit[] | null)?.forEach((order) => {
        const owner = Array.isArray(order.clients) ? order.clients[0] : order.clients
        searchResults.push({
          type: 'order',
          id: order.id,
          clientId: order.client_id,
          title: `${order.garment_type || 'Order'} - ${order.fabric_name || 'No fabric'}`,
          subtitle: clientDisplayName(owner),
        })
      })

      if (cancelled) return
      setResults(searchResults)
      setHighlightedIndex(-1)
      setLoading(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const clear = () => {
    setQuery('')
    setResults([])
    setHighlightedIndex(-1)
  }

  const handleSelect = (result: SearchResult) => {
    clear()
    setShowResults(false)
    onClose?.()
    if (result.type === 'client') {
      router.push(`/clients/${result.id}`)
    } else {
      router.push(`/clients/${result.clientId}/orders/${result.id}/edit`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false)
      ref.current?.blur()
      onClose?.()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setHighlightedIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = highlightedIndex >= 0 ? results[highlightedIndex] : results[0]
      if (pick) handleSelect(pick)
    }
  }

  const open = showResults && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          ref={ref}
          data-testid="search-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="search-results-listbox"
          aria-activedescendant={highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined}
          aria-label="Search clients, orders, fabrics"
          value={query}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            setShowResults(true)
            if (!next.trim()) {
              setResults([])
              setHighlightedIndex(-1)
            }
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search clients, orders, fabrics..."
          className="es-input es-search-input"
          style={{ paddingLeft: 36, paddingRight: 44 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clear()
              ref.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-ink-muted"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div
          data-testid="search-results"
          className="t-dropdown-mount absolute top-full left-0 right-0 mt-2 bg-surface rounded border border-rule z-50 overflow-hidden"
          style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)' }}
        >
          {loading && results.length === 0 ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-gold mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-ink-secondary">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div id="search-results-listbox" role="listbox" className="max-h-[60vh] overflow-y-auto">
              {results.map((result, index) => (
                <button
                  type="button"
                  key={`${result.type}-${result.id}`}
                  id={`search-result-${index}`}
                  data-testid="search-result"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSelect(result)}
                  className={`w-full min-h-[52px] flex items-center gap-3 px-3.5 py-2.5 text-left border-b border-rule last:border-b-0 active:bg-surface-alt ${
                    index === highlightedIndex ? 'bg-surface-alt' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                      result.type === 'client' ? 'bg-gold/10 text-gold' : 'bg-info/10 text-info'
                    }`}
                  >
                    {result.type === 'client' ? <User className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate text-ink">{result.title}</p>
                    <p className="text-xs text-ink-secondary truncate">{result.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-ink-muted uppercase tracking-wide flex-shrink-0">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
