'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'

type BillingAddress = {
  street?: string
  city?: string
  state?: string
  zip?: string
} | null

type Client = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  stage: 'lead' | 'active' | 'vip' | 'dormant'
  notes: string | null
  last_contact_date: string | null
  billing_address: BillingAddress
  location_tags: string[] | null
  birthday_month: string | null
  communication_preference: string | null
  contact_type: string | null
}

type StageFilter = 'all' | 'vip' | 'active' | 'lead' | 'dormant'

type SortField = 'name' | 'email' | 'phone' | 'city' | 'stage' | 'last_contact'
type SortDir = 'asc' | 'desc'

const stageOrder: Record<string, number> = { vip: 0, active: 1, lead: 2, dormant: 3 }

const stageBorderColors: Record<string, string> = {
  vip: 'var(--color-gold)',
  active: 'var(--color-success)',
  lead: 'var(--color-info)',
  dormant: 'var(--color-muted)',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StageFilter>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    async function loadClients() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('last_name', { ascending: true })

      if (error) {
        console.error('Error fetching clients:', error)
      } else {
        setClients(data as Client[])
      }
      setLoading(false)
    }

    loadClients()
  }, [])

  // Extract unique cities from clients
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>()
    clients.forEach(client => {
      const city = client.billing_address?.city?.trim()
      if (city) {
        cities.add(city)
      }
    })
    return Array.from(cities).sort()
  }, [clients])

  // Extract unique location tags
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>()
    clients.forEach(client => {
      if (client.location_tags) {
        client.location_tags.forEach(tag => tags.add(tag))
      }
    })
    return Array.from(tags).sort()
  }, [clients])

  // Filter by stage, city, and location tag
  const filteredClients = useMemo(() => {
    let result = clients

    if (activeFilter !== 'all') {
      result = result.filter(c => c.stage === activeFilter)
    }

    if (cityFilter !== 'all') {
      result = result.filter(c => c.billing_address?.city?.trim() === cityFilter)
    }

    if (tagFilter !== 'all') {
      result = result.filter(c => c.location_tags?.includes(tagFilter))
    }

    return result
  }, [clients, activeFilter, cityFilter, tagFilter])

  // Sort filtered clients
  const sortedClients = useMemo(() => {
    const sorted = [...filteredClients]
    const dir = sortDir === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
          break
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '')
          break
        case 'phone':
          cmp = (a.phone || '').localeCompare(b.phone || '')
          break
        case 'city': {
          const cityA = a.billing_address?.city?.trim() || ''
          const cityB = b.billing_address?.city?.trim() || ''
          cmp = cityA.localeCompare(cityB)
          break
        }
        case 'stage':
          cmp = (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9)
          break
        case 'last_contact':
          cmp = (a.last_contact_date || '').localeCompare(b.last_contact_date || '')
          break
      }
      return cmp * dir
    })

    return sorted
  }, [filteredClients, sortField, sortDir])

  const stageCounts = {
    all: clients.length,
    vip: clients.filter(c => c.stage === 'vip').length,
    active: clients.filter(c => c.stage === 'active').length,
    lead: clients.filter(c => c.stage === 'lead').length,
    dormant: clients.filter(c => c.stage === 'dormant').length,
  }

  const cityCounts = useMemo(() => {
    const stageFiltered = activeFilter === 'all'
      ? clients
      : clients.filter(c => c.stage === activeFilter)

    const counts: Record<string, number> = { all: stageFiltered.length }
    uniqueCities.forEach(city => {
      counts[city] = stageFiltered.filter(c => c.billing_address?.city?.trim() === city).length
    })
    return counts
  }, [clients, activeFilter, uniqueCities])

  const hasActiveFilters = cityFilter !== 'all' || tagFilter !== 'all'

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  const stageFilters: { key: StageFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'vip', label: 'VIP' },
    { key: 'active', label: 'Active' },
    { key: 'lead', label: 'Lead' },
    { key: 'dormant', label: 'Dormant' },
  ]

  return (
    <Layout currentPage="clients">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h1 className="ds-page-title">Clients</h1>
        <span className="ds-label">{filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {stageFilters.map(sf => (
          <button
            key={sf.key}
            onClick={() => setActiveFilter(sf.key)}
            className="ds-btn"
            style={
              activeFilter === sf.key
                ? { background: 'var(--color-charcoal)', color: 'var(--color-cream)' }
                : { background: 'transparent', color: 'var(--color-body)', border: '1px solid var(--color-gray-med)' }
            }
          >
            {sf.label} ({stageCounts[sf.key]})
          </button>
        ))}

        {uniqueCities.length > 0 && (
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="ds-input"
            style={{ width: 'auto', paddingRight: 28 }}
          >
            <option value="all">All Cities ({cityCounts.all})</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>
                {city} ({cityCounts[city] || 0})
              </option>
            ))}
          </select>
        )}

        {uniqueTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="ds-input"
            style={{ width: 'auto', paddingRight: 28 }}
          >
            <option value="all">All Tags</option>
            {uniqueTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => { setCityFilter('all'); setTagFilter('all') }}
            className="ds-btn ds-btn-ghost"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="ds-section">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden md:table-cell">Email</th>
                <th>Phone</th>
                <th className="hidden md:table-cell">City</th>
                <th>Stage</th>
                <th>Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, background: 'var(--color-gray-med)' }} className="animate-pulse" />
                      <div style={{ width: 120, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" />
                    </div>
                  </td>
                  <td className="hidden md:table-cell"><div style={{ width: 160, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" /></td>
                  <td><div style={{ width: 100, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" /></td>
                  <td className="hidden md:table-cell"><div style={{ width: 80, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" /></td>
                  <td><div style={{ width: 50, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" /></td>
                  <td><div style={{ width: 90, height: 12, background: 'var(--color-gray-med)' }} className="animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : sortedClients.length === 0 ? (
        /* Empty state */
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 12 }}>No clients found</p>
          <Link href="/clients/new" className="ds-btn ds-btn-primary">
            Add Client
          </Link>
        </div>
      ) : (
        /* Table */
        <div className="ds-section" style={{ padding: 0 }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => handleSort('name')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    Name{sortIndicator('name')}
                  </button>
                </th>
                <th aria-sort={sortField === 'email' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="hidden md:table-cell">
                  <button type="button" onClick={() => handleSort('email')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    Email{sortIndicator('email')}
                  </button>
                </th>
                <th aria-sort={sortField === 'phone' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => handleSort('phone')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    Phone{sortIndicator('phone')}
                  </button>
                </th>
                <th aria-sort={sortField === 'city' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="hidden md:table-cell">
                  <button type="button" onClick={() => handleSort('city')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    City{sortIndicator('city')}
                  </button>
                </th>
                <th aria-sort={sortField === 'stage' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => handleSort('stage')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    Stage{sortIndicator('stage')}
                  </button>
                </th>
                <th aria-sort={sortField === 'last_contact' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => handleSort('last_contact')} className="w-full text-left bg-transparent border-none cursor-pointer font-inherit">
                    Last Contact{sortIndicator('last_contact')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client, idx) => {
                const initials = `${client.first_name[0]}${client.last_name[0]}`
                const city = client.billing_address?.city?.trim() || ''
                const rowBg = idx % 2 === 1 ? 'var(--color-ivory)' : 'var(--color-warm-white)'

                return (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clients/${client.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/clients/${client.id}`) } }}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="link"
                      style={{ background: rowBg, height: 32 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            className="ds-avatar"
                            style={{
                              background: 'var(--color-charcoal)',
                              color: 'var(--color-cream)',
                              width: 28,
                              height: 28,
                            }}
                          >
                            {initials}
                          </div>
                          <span style={{ fontWeight: 500 }}>
                            {client.first_name} {client.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell" style={{ color: client.email ? 'var(--color-body)' : 'var(--color-muted)' }}>
                        {client.email || '\u2014'}
                      </td>
                      <td style={{ color: client.phone ? 'var(--color-body)' : 'var(--color-muted)' }}>
                        {client.phone || '\u2014'}
                      </td>
                      <td className="hidden md:table-cell" style={{ color: city ? 'var(--color-body)' : 'var(--color-muted)' }}>
                        {city || '\u2014'}
                      </td>
                      <td>
                        <span
                          className="ds-status"
                          style={{ borderLeftColor: stageBorderColors[client.stage] || 'var(--color-muted)' }}
                        >
                          {client.stage.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {client.last_contact_date ? (
                          <span>{formatDate(client.last_contact_date)}</span>
                        ) : (
                          <span style={{ color: 'var(--color-muted)' }}>Never</span>
                        )}
                      </td>
                    </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
