'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Trash2, CheckSquare } from 'lucide-react'
import Layout from '@/components/Layout'
import ConfirmModal from '@/components/ConfirmModal'
import { useToast } from '@/components/motion/Toast'
import { createClient } from '@/lib/supabase'
import { clientDisplayName, clientInitials } from '@/lib/clientDisplay'
import {
  LAST_PURCHASE_OPTIONS,
  lastPurchaseBucket,
  matchesSearch,
  uniqueTags as collectTags,
  type LastPurchaseBucket,
} from '@/lib/clientFilters'

type BillingAddress = { street?: string; city?: string; state?: string; zip?: string } | null

type Client = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  stage: 'lead' | 'active' | 'vip' | 'dormant'
  last_contact_date: string | null
  last_purchase_date: string | null
  billing_address: BillingAddress
  location_tags: string[] | null
}

type StageFilter = 'all' | 'vip' | 'active' | 'lead' | 'dormant'
type SortKey = 'name' | 'last_purchase' | 'last_contact' | 'city' | 'stage'

const STAGES: StageFilter[] = ['all', 'vip', 'active', 'lead', 'dormant']
const stageOrder: Record<string, number> = { vip: 0, active: 1, lead: 2, dormant: 3 }
const stageColors: Record<string, string> = {
  vip: 'var(--color-gold)',
  active: 'var(--color-success)',
  lead: 'var(--color-info)',
  dormant: 'var(--color-muted)',
}

const CLIENT_COLUMNS = 'id, first_name, last_name, email, phone, stage, last_contact_date, last_purchase_date, billing_address, location_tags'
const PAGE = 1000 // PostgREST returns at most 1000 rows per request

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ClientsContent() {
  const router = useRouter()
  const params = useSearchParams()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters start from the URL so dashboard links (?stage=vip, ?contact=never) land pre-filtered.
  const initialStage = params.get('stage') as StageFilter | null
  const [search, setSearch] = useState(params.get('q') || '')
  const [stageFilter, setStageFilter] = useState<StageFilter>(initialStage && STAGES.includes(initialStage) ? initialStage : 'all')
  const [cityFilter, setCityFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(params.get('tag') || 'all')
  const [purchaseFilter, setPurchaseFilter] = useState<LastPurchaseBucket | 'all'>((params.get('purchase') as LastPurchaseBucket) || 'all')
  const [neverContacted, setNeverContacted] = useState(params.get('contact') === 'never')
  const [sortKey, setSortKey] = useState<SortKey>((params.get('sort') as SortKey) || 'name')

  // Bulk select / delete
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    async function loadClients() {
      const supabase = createClient()
      const all: Client[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('clients')
          .select(CLIENT_COLUMNS)
          .order('last_name', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) {
          console.error('Error fetching clients:', error.message)
          setLoadError('Could not load clients. Pull down to refresh or try again.')
          break
        }
        all.push(...((data || []) as Client[]))
        if (!data || data.length < PAGE) break
      }
      setClients(all)
      setLoading(false)
    }
    loadClients()
  }, [])

  const uniqueCities = useMemo(
    () => [...new Set(clients.map((c) => c.billing_address?.city?.trim()).filter(Boolean) as string[])].sort(),
    [clients],
  )
  const allTags = useMemo(() => collectTags(clients.map((c) => c.location_tags)), [clients])

  const filtered = useMemo(() => {
    const now = new Date()
    return clients.filter((c) => {
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false
      if (cityFilter !== 'all' && c.billing_address?.city?.trim() !== cityFilter) return false
      if (tagFilter !== 'all' && !(c.location_tags || []).some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false
      if (purchaseFilter !== 'all' && lastPurchaseBucket(c.last_purchase_date, now) !== purchaseFilter) return false
      if (neverContacted && c.last_contact_date) return false
      return matchesSearch(c, search)
    })
  }, [clients, stageFilter, cityFilter, tagFilter, purchaseFilter, neverContacted, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const byName = (a: Client, b: Client) =>
      `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`)
    list.sort((a, b) => {
      switch (sortKey) {
        case 'last_purchase': // most recent first, never-purchased last
          return (b.last_purchase_date || '').localeCompare(a.last_purchase_date || '') || byName(a, b)
        case 'last_contact': // longest since contact first
          return (a.last_contact_date || '9999').localeCompare(b.last_contact_date || '9999') || byName(a, b)
        case 'city':
          return (a.billing_address?.city || 'zzz').localeCompare(b.billing_address?.city || 'zzz') || byName(a, b)
        case 'stage':
          return (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9) || byName(a, b)
        default:
          return byName(a, b)
      }
    })
    return list
  }, [filtered, sortKey])

  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = { all: clients.length, vip: 0, active: 0, lead: 0, dormant: 0 }
    clients.forEach((c) => { if (c.stage in counts) counts[c.stage] += 1 })
    return counts
  }, [clients])

  const hasFilters = stageFilter !== 'all' || cityFilter !== 'all' || tagFilter !== 'all' || purchaseFilter !== 'all' || neverContacted || search.trim() !== ''
  const clearFilters = () => {
    setStageFilter('all'); setCityFilter('all'); setTagFilter('all'); setPurchaseFilter('all'); setNeverContacted(false); setSearch('')
  }

  // ---- selection ----
  const visibleIds = useMemo(() => sorted.map((c) => c.id), [sorted])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()) }
  const selectedWithPurchases = useMemo(
    () => clients.filter((c) => selected.has(c.id) && c.last_purchase_date).length,
    [clients, selected],
  )

  async function deleteSelected() {
    setDeleting(true)
    const ids = [...selected]
    let deleted = 0
    try {
      for (let at = 0; at < ids.length; at += 200) {
        const res = await fetch('/api/clients/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids.slice(at, at + 200) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        deleted += data.deleted
      }
      const gone = new Set(ids)
      setClients((prev) => prev.filter((c) => !gone.has(c.id)))
      toast.success(`Deleted ${deleted} client${deleted !== 1 ? 's' : ''}`)
      exitSelectMode()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <Layout currentPage="clients">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="ds-page-title">Clients</h1>
          <span className="ds-label" data-testid="client-count">{sorted.length} client{sorted.length !== 1 ? 's' : ''}</span>
        </div>
        {selectMode ? (
          <button type="button" onClick={exitSelectMode} className="es-btn es-btn-secondary es-btn-sm" data-testid="select-mode-cancel">
            Done
          </button>
        ) : (
          <button type="button" onClick={() => setSelectMode(true)} className="es-btn es-btn-secondary es-btn-sm" data-testid="select-mode-toggle">
            <CheckSquare className="w-4 h-4" />
            Select
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients by name, email, or phone…"
          aria-label="Search clients"
          data-testid="client-search"
          autoComplete="off"
          className="es-input es-search-input"
          style={{ paddingLeft: 36, paddingRight: 44, height: 44 }}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-0 top-0 w-[44px] h-[44px] flex items-center justify-center text-ink-muted">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by stage">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-pressed={stageFilter === stage}
            data-testid={`stage-${stage}`}
            onClick={() => setStageFilter(stage)}
            className="es-chip"
          >
            <span>{stage === 'all' ? 'All' : stage === 'vip' ? 'VIP' : stage[0].toUpperCase() + stage.slice(1)}</span>
            <span className="es-chip-count">{stageCounts[stage]}</span>
          </button>
        ))}
      </div>

      {/* Dropdown filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="es-input" aria-label="Filter by Tag" data-testid="filter-tag">
          <option value="all">Filter by Tag: All</option>
          {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select value={purchaseFilter} onChange={(e) => setPurchaseFilter(e.target.value as LastPurchaseBucket | 'all')} className="es-input" aria-label="Last Purchase" data-testid="filter-last-purchase">
          <option value="all">Last Purchase: Any</option>
          {LAST_PURCHASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="es-input" aria-label="Filter by city" data-testid="filter-city">
          <option value="all">City: All</option>
          {uniqueCities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="es-input" aria-label="Sort clients" data-testid="sort-clients">
          <option value="name">Sort: Name</option>
          <option value="last_purchase">Sort: Most recent purchase</option>
          <option value="last_contact">Sort: Longest since contact</option>
          <option value="city">Sort: City</option>
          <option value="stage">Sort: Stage</option>
        </select>
      </div>

      {(hasFilters || neverContacted) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-[13px] text-ink-secondary">
          {neverContacted && <span className="es-tag es-tag-static">Never contacted</span>}
          <button type="button" onClick={clearFilters} className="es-btn-ghost min-h-[44px]" data-testid="clear-filters">Clear filters</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 mb-3 px-4 py-2 bg-surface border border-rule rounded" data-testid="bulk-bar">
          <label className="flex items-center gap-3 min-h-[44px] cursor-pointer text-sm font-semibold">
            <input type="checkbox" className="es-check" checked={allVisibleSelected} onChange={toggleAllVisible} data-testid="select-all" />
            Select All ({visibleIds.length})
          </label>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setConfirmOpen(true)}
            className="es-btn es-btn-danger es-btn-sm"
            style={{ height: 44 }}
            data-testid="delete-selected"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selected.size})
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="border border-rule bg-surface" data-testid="clients-loading">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="es-row">
              <div className="flex items-center gap-3 flex-1">
                <div className="es-skeleton" style={{ width: 36, height: 36 }} />
                <div className="flex-1">
                  <div className="es-skeleton mb-2" style={{ width: '40%', height: 12 }} />
                  <div className="es-skeleton" style={{ width: '60%', height: 10 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div role="alert" className="px-4 py-6 text-center text-error text-sm">{loadError}</div>
      ) : sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-ink-muted text-[13px] mb-3">No clients match these filters.</p>
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="es-btn es-btn-secondary">Clear filters</button>
          ) : (
            <Link href="/clients/new" className="es-btn es-btn-primary">Add Client</Link>
          )}
        </div>
      ) : (
        <div className="border border-rule bg-surface" data-testid="client-list">
          {sorted.map((client, idx) => {
            const city = client.billing_address?.city?.trim() || ''
            const isSelected = selected.has(client.id)
            const open = () => (selectMode ? toggleOne(client.id) : router.push(`/clients/${client.id}`))
            return (
              <div
                key={client.id}
                data-testid="client-card"
                role={selectMode ? 'checkbox' : 'link'}
                aria-checked={selectMode ? isSelected : undefined}
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                className={`es-row es-reveal cursor-pointer ${isSelected ? 'bg-surface-alt' : ''}`}
                style={{ minHeight: 60, ['--i' as string]: Math.min(idx, 16) }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {selectMode && (
                    <input
                      type="checkbox"
                      className="es-check"
                      checked={isSelected}
                      onChange={() => toggleOne(client.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${clientDisplayName(client)}`}
                      data-testid="client-checkbox"
                    />
                  )}
                  <div className="es-avatar">{clientInitials(client)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{clientDisplayName(client)}</div>
                    <div className="text-ink-muted text-[12px] truncate">
                      {[client.email, city].filter(Boolean).join(' · ') || client.phone || 'No contact info'}
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                  {(client.location_tags || []).slice(0, 2).map((tag) => (
                    <span key={tag} className="es-tag es-tag-static" style={{ minHeight: 24, fontSize: 11 }}>{tag}</span>
                  ))}
                </div>
                <div className="flex-shrink-0 text-right" style={{ minWidth: 92 }}>
                  <div className="es-status justify-end" style={{ color: stageColors[client.stage] || 'var(--color-muted)' }}>
                    <span className="text-ink text-[11px] font-semibold uppercase tracking-wide">{client.stage}</span>
                  </div>
                  <div className="text-ink-muted text-[11px] whitespace-nowrap">
                    {client.last_purchase_date ? formatDate(client.last_purchase_date) : 'No purchases'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Delete ${selected.size} client${selected.size !== 1 ? 's' : ''}?`}
        message={
          <>
            This cannot be undone. Their orders, purchases, measurements, care items and email history are deleted too.
            {selectedWithPurchases > 0 && (
              <span className="block mt-3 font-semibold text-error" data-testid="delete-warning">
                {selectedWithPurchases} of the selected client{selectedWithPurchases !== 1 ? 's have' : ' has'} purchase history in the CRM.
              </span>
            )}
          </>
        }
        confirmLabel={`Delete ${selected.size}`}
        destructive
        busy={deleting}
        onConfirm={deleteSelected}
        onCancel={() => setConfirmOpen(false)}
      />
    </Layout>
  )
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<Layout currentPage="clients"><div className="py-12 text-center text-ink-muted text-sm">Loading…</div></Layout>}>
      <ClientsContent />
    </Suspense>
  )
}
