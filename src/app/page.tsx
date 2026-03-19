'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import StatusBadge from '@/components/StatusBadge'
import { createClient } from '@/lib/supabase'

interface ClientDeadline {
  id: string
  first_name: string
  last_name: string
  need_by_date: string
  need_by_description: string | null
}

interface DashboardStats {
  totalClients: number
  activeClients: number
  vipClients: number
  ordersInProgress: number
  upcomingDeadlines: ClientDeadline[]
  clientsNeedingFollowUp: ClientFollowUp[]
  recentOrders: RecentOrder[]
  careItemsDue: CareItemDue[]
  revenueThisMonth: number
  revenueLastMonth: number
  ordersThisMonth: number
  ordersLastMonth: number
}

interface ClientFollowUp {
  id: string
  first_name: string
  last_name: string
  last_contact_date: string | null
  stage: string
  daysSinceContact: number
}

interface RecentOrder {
  id: string
  garment_type: string
  status: string
  order_date: string
  price: number | null
  client: {
    id: string
    first_name: string
    last_name: string
  }
}

interface CareItemDue {
  id: string
  title: string
  due_date: string
  client: {
    id: string
    first_name: string
    last_name: string
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient()

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const threeMonthsAgo = new Date(now)
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const [
        clientsRes,
        ordersInProgressRes,
        upcomingDeadlinesRes,
        recentOrdersRes,
        careItemsRes,
        ordersThisMonthRes,
        ordersLastMonthRes,
      ] = await Promise.all([
        supabase.from('clients').select('id, stage, last_contact_date, first_name, last_name'),
        supabase
          .from('custom_orders')
          .select('id, garment_type, status, eta_start, eta_end, client:clients(id, first_name, last_name)')
          .neq('status', 'delivered')
          .order('eta_end', { ascending: true }),
        supabase
          .from('clients')
          .select('id, first_name, last_name, need_by_date, need_by_description')
          .not('need_by_date', 'is', null)
          .gte('need_by_date', new Date().toISOString().split('T')[0])
          .order('need_by_date', { ascending: true })
          .limit(10),
        supabase
          .from('custom_orders')
          .select('id, garment_type, status, order_date, price, client:clients(id, first_name, last_name)')
          .order('order_date', { ascending: false })
          .limit(5),
        supabase
          .from('client_care_items')
          .select('id, title, due_date, client:clients(id, first_name, last_name)')
          .eq('completed', false)
          .not('due_date', 'is', null)
          .lte('due_date', new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('due_date', { ascending: true })
          .limit(5),
        supabase
          .from('custom_orders')
          .select('price')
          .gte('order_date', startOfMonth.toISOString().split('T')[0]),
        supabase
          .from('custom_orders')
          .select('price')
          .gte('order_date', startOfLastMonth.toISOString().split('T')[0])
          .lte('order_date', endOfLastMonth.toISOString().split('T')[0]),
      ])

      const clients = clientsRes.data || []
      const ordersInProgress = ordersInProgressRes.data || []
      const upcomingDeadlines = upcomingDeadlinesRes.data || []
      const recentOrders = recentOrdersRes.data || []
      const careItems = careItemsRes.data || []
      const ordersThisMonth = ordersThisMonthRes.data || []
      const ordersLastMonth = ordersLastMonthRes.data || []

      const clientsNeedingFollowUp = clients
        .filter(c => {
          if (!c.last_contact_date) return true
          const lastContact = new Date(c.last_contact_date)
          return lastContact < threeMonthsAgo
        })
        .map(c => ({
          ...c,
          daysSinceContact: c.last_contact_date
            ? Math.floor((now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
            : 999
        }))
        .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
        .slice(0, 5)

      const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + (o.price || 0), 0)
      const revenueLastMonth = ordersLastMonth.reduce((sum, o) => sum + (o.price || 0), 0)

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter(c => c.stage === 'active').length,
        vipClients: clients.filter(c => c.stage === 'vip').length,
        ordersInProgress: ordersInProgress.length,
        upcomingDeadlines: upcomingDeadlines as ClientDeadline[],
        clientsNeedingFollowUp: clientsNeedingFollowUp as ClientFollowUp[],
        recentOrders: recentOrders as unknown as RecentOrder[],
        careItemsDue: careItems as unknown as CareItemDue[],
        revenueThisMonth,
        revenueLastMonth,
        ordersThisMonth: ordersThisMonth.length,
        ordersLastMonth: ordersLastMonth.length,
      })

      setLoading(false)
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="flex items-center justify-center" style={{ paddingTop: '80px' }}>
          <Loader2 className="animate-spin text-gold" style={{ width: '24px', height: '24px' }} />
        </div>
      </Layout>
    )
  }

  if (!stats) return null

  const revenueChange = stats.revenueLastMonth > 0
    ? ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth * 100).toFixed(0)
    : stats.revenueThisMonth > 0 ? '100' : '0'

  const revenueUp = stats.revenueThisMonth >= stats.revenueLastMonth

  return (
    <Layout currentPage="dashboard">
      <div className="flex flex-col" style={{ gap: '12px' }}>

        {/* Header */}
        <div>
          <span className="ds-label">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <h1 className="ds-page-title">Dashboard</h1>
        </div>

        {/* KPI Strip */}
        <div className="bg-warm-white border border-gray-med flex" style={{ height: '56px' }}>
          <Link href="/clients" className="flex-1 flex flex-col justify-center px-3">
            <span className="ds-label">Total Clients</span>
            <span className="ds-metric">{stats.totalClients}</span>
          </Link>
          <div className="w-px bg-gray-med" />
          <Link href="/orders" className="flex-1 flex flex-col justify-center px-3">
            <span className="ds-label">In Progress</span>
            <span className={`ds-metric ${stats.ordersInProgress > 0 ? 'text-gold' : ''}`}>{stats.ordersInProgress}</span>
          </Link>
          <div className="w-px bg-gray-med" />
          <Link href="/clients?stage=vip" className="flex-1 flex flex-col justify-center px-3">
            <span className="ds-label">VIP Clients</span>
            <span className="ds-metric">{stats.vipClients}</span>
          </Link>
          <div className="w-px bg-gray-med" />
          <Link href="/clients?stage=active" className="flex-1 flex flex-col justify-center px-3">
            <span className="ds-label">Active</span>
            <span className="ds-metric">{stats.activeClients}</span>
          </Link>
        </div>

        {/* Revenue Section */}
        <div className="ds-section-tinted">
          <div className="ds-section-header">Revenue</div>
          <div className="grid grid-cols-3" style={{ gap: '12px' }}>
            <div>
              <span className="ds-label">This Month</span>
              <div className="ds-metric">${stats.revenueThisMonth.toLocaleString()}</div>
              <span className="text-muted" style={{ fontSize: '11px' }}>{stats.ordersThisMonth} order{stats.ordersThisMonth !== 1 ? 's' : ''}</span>
            </div>
            <div>
              <span className="ds-label">Last Month</span>
              <div className="ds-metric">${stats.revenueLastMonth.toLocaleString()}</div>
              <span className="text-muted" style={{ fontSize: '11px' }}>{stats.ordersLastMonth} order{stats.ordersLastMonth !== 1 ? 's' : ''}</span>
            </div>
            <div>
              <span className="ds-label">Change</span>
              <div className={`ds-metric ${revenueUp ? 'text-success' : 'text-error'}`}>
                {revenueUp ? '+' : ''}{revenueChange}%
              </div>
              <span className="text-muted" style={{ fontSize: '11px' }}>vs last month</span>
            </div>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px' }}>

          {/* LEFT column */}
          <div className="flex flex-col" style={{ gap: '12px' }}>
            {/* Deadlines */}
            <div className="ds-section">
              <div className="ds-section-header">Deadlines</div>
              {stats.upcomingDeadlines.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px', padding: '8px 0' }}>No upcoming deadlines.</p>
              ) : (
                stats.upcomingDeadlines.map(client => {
                  const daysLeft = Math.ceil((new Date(client.need_by_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysLeft <= 14
                  return (
                    <Link key={client.id} href={`/clients/${client.id}`} className="block">
                      <div className="ds-row" style={{ justifyContent: 'space-between' }}>
                        <div className="min-w-0 mr-4" style={{ overflow: 'hidden' }}>
                          <span className="truncate block" style={{ fontWeight: 500 }}>{client.first_name} {client.last_name}</span>
                          <span className="truncate block text-muted" style={{ fontSize: '11px' }}>{client.need_by_description || 'Deadline'}</span>
                        </div>
                        <span className={`flex-shrink-0 whitespace-nowrap font-semibold ${isUrgent ? 'text-error' : 'text-gold'}`} style={{ fontSize: '13px' }}>
                          {daysLeft}d — {new Date(client.need_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Care Items */}
            <div className="ds-section-tinted">
              <div className="ds-section-header">Care Items</div>
              {stats.careItemsDue.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px', padding: '8px 0' }}>No care items due soon.</p>
              ) : (
                stats.careItemsDue.map(item => {
                  const isOverdue = new Date(item.due_date) < new Date()
                  return (
                    <Link key={item.id} href={`/clients/${item.client?.id}`} className="block">
                      <div className="ds-row" style={{ justifyContent: 'space-between' }}>
                        <div className="min-w-0 mr-4" style={{ overflow: 'hidden' }}>
                          <span className="truncate block" style={{ fontWeight: 500 }}>{item.title}</span>
                          <span className="truncate block text-muted" style={{ fontSize: '11px' }}>{item.client?.first_name} {item.client?.last_name}</span>
                        </div>
                        <span className={`flex-shrink-0 whitespace-nowrap font-semibold ${isOverdue ? 'text-error' : 'text-gold'}`} style={{ fontSize: '13px' }}>
                          {isOverdue ? 'Overdue' : new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* RIGHT column */}
          <div className="flex flex-col" style={{ gap: '12px' }}>
            {/* Follow-Up */}
            <div className="ds-section">
              <div className="ds-section-header">Follow-Up</div>
              {stats.clientsNeedingFollowUp.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px', padding: '8px 0' }}>All clients are up to date.</p>
              ) : (
                stats.clientsNeedingFollowUp.map(client => (
                  <Link key={client.id} href={`/clients/${client.id}`} className="block">
                    <div className="ds-row" style={{ justifyContent: 'space-between' }}>
                      <div className="flex items-center min-w-0 mr-4" style={{ gap: '8px' }}>
                        <div className="ds-avatar bg-charcoal text-cream">{client.first_name[0]}{client.last_name[0]}</div>
                        <div className="min-w-0" style={{ overflow: 'hidden' }}>
                          <span className="truncate block" style={{ fontWeight: 500 }}>{client.first_name} {client.last_name}</span>
                          <span className="truncate block text-muted capitalize" style={{ fontSize: '11px' }}>{client.stage}</span>
                        </div>
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap font-semibold text-warning" style={{ fontSize: '13px' }}>
                        {client.daysSinceContact === 999 ? 'Never' : `${client.daysSinceContact}d`}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Recent Orders */}
            <div className="ds-section-tinted">
              <div className="ds-section-header flex items-center justify-between">
                <span>Recent Orders</span>
                <Link href="/orders" className="ds-btn-ghost">View All</Link>
              </div>
              {stats.recentOrders.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px', padding: '8px 0' }}>No recent orders.</p>
              ) : (
                stats.recentOrders.map(order => (
                  <Link key={order.id} href={`/clients/${order.client?.id}`} className="block">
                    <div className="ds-row" style={{ justifyContent: 'space-between' }}>
                      <div className="min-w-0 mr-4" style={{ overflow: 'hidden' }}>
                        <span className="truncate block" style={{ fontWeight: 500 }}>{order.client?.first_name} {order.client?.last_name}</span>
                        <span className="truncate block text-muted" style={{ fontSize: '11px' }}>{order.garment_type}</span>
                      </div>
                      <div className="flex items-center flex-shrink-0 whitespace-nowrap" style={{ gap: '8px' }}>
                        <StatusBadge status={order.status} size="sm" />
                        {order.price && <span className="font-semibold">${order.price.toLocaleString()}</span>}
                        <span className="text-muted" style={{ fontSize: '11px' }}>{new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}

