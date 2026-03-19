'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, ShoppingBag, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type SearchResult = {
  type: 'client' | 'order'
  id: string
  clientId?: string
  title: string
  subtitle: string
}

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const searchResults: SearchResult[] = []

      // Search clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5)

      if (clients) {
        clients.forEach(client => {
          searchResults.push({
            type: 'client',
            id: client.id,
            title: `${client.first_name} ${client.last_name}`,
            subtitle: client.email || client.phone || 'No contact info',
          })
        })
      }

      // Search orders by fabric name or garment type
      const { data: orders } = await supabase
        .from('custom_orders')
        .select('id, client_id, garment_type, fabric_name, clients(first_name, last_name)')
        .or(`fabric_name.ilike.%${query}%,garment_type.ilike.%${query}%`)
        .limit(5)

      if (orders) {
        orders.forEach((order: any) => {
          searchResults.push({
            type: 'order',
            id: order.id,
            clientId: order.client_id,
            title: `${order.garment_type} - ${order.fabric_name || 'No fabric'}`,
            subtitle: `${order.clients?.first_name} ${order.clients?.last_name}`,
          })
        })
      }

      setResults(searchResults)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (result: SearchResult) => {
    setQuery('')
    setShowResults(false)
    if (result.type === 'client') {
      router.push(`/clients/${result.id}`)
    } else {
      router.push(`/clients/${result.clientId}/orders/${result.id}/edit`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-lg">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-dark" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search clients, orders, fabrics..."
          className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-med bg-gray-light font-body text-sm focus:outline-none focus:border-gold focus:bg-white transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-dark hover:text-[#2D2D2D]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-med z-50 overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)' }}>
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-gold mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center font-body text-sm text-gray-dark">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-light transition-colors text-left border-b border-gray-med last:border-b-0"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.type === 'client' ? 'bg-gold/10 text-gold' : 'bg-blue-50 text-blue-500'
                  }`}>
                    {result.type === 'client' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <ShoppingBag className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-medium text-sm truncate text-[#2D2D2D]">{result.title}</p>
                    <p className="font-body text-xs text-gray-dark truncate">{result.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-gray-dark uppercase tracking-wide flex-shrink-0">
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
