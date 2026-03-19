'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Users, MapPin, ChevronDown, Tag } from 'lucide-react'
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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StageFilter>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')

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

  return (
    <Layout currentPage="clients">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Clients</h1>
          <p className="font-body text-gray-dark">
            {filteredClients.length} {activeFilter === 'all' ? 'total' : activeFilter} client{filteredClients.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stage Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <StagePill
            label="All"
            count={stageCounts.all}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StagePill
            label="VIP"
            count={stageCounts.vip}
            active={activeFilter === 'vip'}
            onClick={() => setActiveFilter('vip')}
            color="bg-gold"
          />
          <StagePill
            label="Active"
            count={stageCounts.active}
            active={activeFilter === 'active'}
            onClick={() => setActiveFilter('active')}
            color="bg-green-500"
          />
          <StagePill
            label="Lead"
            count={stageCounts.lead}
            active={activeFilter === 'lead'}
            onClick={() => setActiveFilter('lead')}
            color="bg-blue-500"
          />
          <StagePill
            label="Dormant"
            count={stageCounts.dormant}
            active={activeFilter === 'dormant'}
            onClick={() => setActiveFilter('dormant')}
            color="bg-gray-dark"
          />
        </div>
      </div>

      {/* Location Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {uniqueCities.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-gray-dark">
              <MapPin className="w-4 h-4" />
              <span className="font-body text-sm font-medium">City:</span>
            </div>
            <div className="relative">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-med rounded-xl px-4 py-2 pr-10 font-body text-sm focus:outline-none focus:border-gold cursor-pointer hover:border-gold transition-colors"
              >
                <option value="all">All Cities ({cityCounts.all})</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>
                    {city} ({cityCounts[city] || 0})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-dark pointer-events-none" />
            </div>
          </div>
        )}

        {uniqueTags.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-gray-dark">
              <Tag className="w-4 h-4" />
              <span className="font-body text-sm font-medium">Location Tag:</span>
            </div>
            <div className="relative">
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-med rounded-xl px-4 py-2 pr-10 font-body text-sm focus:outline-none focus:border-gold cursor-pointer hover:border-gold transition-colors"
              >
                <option value="all">All Tags</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-dark pointer-events-none" />
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => { setCityFilter('all'); setTagFilter('all') }}
            className="text-[#2D2D2D] hover:text-gold font-body text-sm font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-med animate-pulse" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-med rounded-full" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-med rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-med rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Clients Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-med mx-auto mb-4" />
              {clients.length === 0 ? (
                <>
                  <h2 className="font-heading text-xl text-gray-dark">No clients yet</h2>
                  <p className="font-body text-gray-dark mt-2">Add your first client to get started.</p>
                  <Link
                    href="/clients/new"
                    className="inline-block mt-4 bg-[#2D2D2D] hover:bg-[#404040] text-white px-6 py-2 rounded-lg font-body font-medium transition-colors"
                  >
                    Add Client
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-xl text-gray-dark">No matching clients</h2>
                  <p className="font-body text-gray-dark mt-2">
                    Try selecting a different filter or add a new client.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

function StagePill({
  label,
  count,
  active = false,
  onClick,
  color,
}: {
  label: string
  count: number
  active?: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl font-body text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
        active
          ? 'bg-[#2D2D2D] text-white'
          : 'bg-white text-gray-dark border border-gray-med hover:border-gold'
      }`}
    >
      {color && !active && (
        <span className={`w-2 h-2 rounded-full ${color}`} />
      )}
      {label} ({count})
    </button>
  )
}

function ClientCard({ client }: { client: Client }) {
  const initials = `${client.first_name[0]}${client.last_name[0]}`
  const city = client.billing_address?.city?.trim()

  const stageColors = {
    vip: 'bg-gold text-white',
    active: 'bg-green-500 text-white',
    lead: 'bg-blue-500 text-white',
    dormant: 'bg-gray-dark text-white',
  }

  return (
    <Link href={`/clients/${client.id}`}>
      <div className="bg-white rounded-2xl p-5 lg:p-6 border border-gray-med hover:border-gray-dark/20 hover:shadow-sm transition-all cursor-pointer" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 lg:w-12 lg:h-12 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-heading font-medium text-sm lg:text-base">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-medium text-base lg:text-lg text-[#2D2D2D] truncate">
              {client.first_name} {client.last_name}
            </h3>
            {client.email && (
              <p className="font-body text-sm text-gray-dark truncate">{client.email}</p>
            )}
            {client.phone && (
              <p className="font-body text-sm text-gray-dark">{client.phone}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {city && (
                <p className="font-body text-xs text-gray-dark flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {city}
                </p>
              )}
              {client.communication_preference && (
                <span className="font-body text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded capitalize">
                  {client.communication_preference}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 lg:mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-lg text-[11px] font-medium uppercase whitespace-nowrap ${stageColors[client.stage]}`}>
              {client.stage}
            </span>
            {client.contact_type === 'referral' && (
              <span className="px-3 py-1 rounded-lg text-[11px] font-medium uppercase whitespace-nowrap bg-purple-500 text-white">
                Referral
              </span>
            )}
            {client.location_tags && client.location_tags.length > 0 && (
              <div className="flex gap-1">
                {client.location_tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gold/10 text-gold rounded-full text-[10px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {client.last_contact_date && (
            <p className="font-body text-xs text-gray-dark">
              Last: {new Date(client.last_contact_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
