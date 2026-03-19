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
      <Layout currentPage="dashboard" title="Dashboard">
        <div className="flex items-center justify-center" style={{ height: '60vh' }}>
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
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
    <Layout currentPage="dashboard" title="Dashboard">
      <div className="flex flex-col gap-4 p-4">

        {/* ===== REVENUE — first thing she looks at ===== */}
        <section>
          <div className="es-section-header">Revenue</div>
          <div className="grid grid-cols-3 gap-px bg-rule border border-rule">
            <div className="bg-surface" style={{ padding: '16px 20px' }}>
              <div className="es-label mb-1">This Month</div>
              <div className="es-metric">${stats.revenueThisMonth.toLocaleString()}</div>
              <div className="text-ink-muted text-[12px] mt-1">{stats.ordersThisMonth} order{stats.ordersThisMonth !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-surface" style={{ padding: '16px 20px' }}>
              <div className="es-label mb-1">Last Month</div>
              <div className="es-metric">${stats.revenueLastMonth.toLocaleString()}</div>
              <div className="text-ink-muted text-[12px] mt-1">{stats.ordersLastMonth} order{stats.ordersLastMonth !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-surface" style={{ padding: '16px 20px' }}>
              <div className="es-label mb-1">Change</div>
              <div className={`es-metric ${revenueUp ? 'text-success' : 'text-error'}`}>
                {revenueUp ? '+' : ''}{revenueChange}%
              </div>
              <div className="text-ink-muted text-[12px] mt-1">vs last month</div>
            </div>
          </div>
        </section>

        {/* ===== QUICK STATS ===== */}
        <div className="grid grid-cols-4 gap-px bg-rule border border-rule">
          <Link href="/clients" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">Clients</div>
            <div className="es-metric-sm">{stats.totalClients}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/orders" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">In Progress</div>
            <div className={`es-metric-sm ${stats.ordersInProgress > 0 ? 'text-gold' : ''}`}>{stats.ordersInProgress}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/clients?stage=vip" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">VIP</div>
            <div className="es-metric-sm">{stats.vipClients}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/clients?stage=active" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">Active</div>
            <div className="es-metric-sm">{stats.activeClients}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
        </div>

        {/* ===== DEADLINES ===== */}
        {stats.upcomingDeadlines.length > 0 && (
          <section>
            <div className="es-section-header">
              Deadlines <span className="text-error ml-1 normal-case tracking-normal">{stats.upcomingDeadlines.length}</span>
            </div>
            {stats.upcomingDeadlines.map(client => {
              const daysLeft = Math.ceil((new Date(client.need_by_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              const urgent = daysLeft <= 14
              return (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <div className="es-row justify-between">
                    <div className="min-w-0 mr-4">
                      <div className="font-semibold truncate">{client.first_name} {client.last_name}</div>
                      <div className="text-ink-muted text-[12px] truncate">{client.need_by_description || 'Deadline'}</div>
                    </div>
                    <div className={`flex-shrink-0 font-semibold ${urgent ? 'text-error' : 'text-gold'}`}>{daysLeft}d</div>
                  </div>
                </Link>
              )
            })}
          </section>
        )}

        {/* ===== FOLLOW-UP ===== */}
        {stats.clientsNeedingFollowUp.length > 0 && (
          <section>
            <div className="es-section-header">
              Follow-Up <span className="text-warning ml-1 normal-case tracking-normal">{stats.clientsNeedingFollowUp.length}</span>
            </div>
            {stats.clientsNeedingFollowUp.map(client => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="es-row justify-between">
                  <div className="flex items-center gap-3 min-w-0 mr-4">
                    <div className="es-avatar">{client.first_name[0]}{client.last_name[0]}</div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{client.first_name} {client.last_name}</div>
                      <div className="text-ink-muted text-[12px] capitalize">{client.stage}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 font-semibold text-warning">
                    {client.daysSinceContact === 999 ? 'Never' : `${client.daysSinceContact}d`}
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* ===== RECENT ORDERS ===== */}
        <section>
          <div className="es-section-header flex items-center justify-between">
            <span>Recent Orders</span>
            <Link href="/orders" className="es-btn-ghost normal-case tracking-normal">View All</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="py-4 text-ink-muted text-[13px]">No recent orders.</div>
          ) : (
            stats.recentOrders.map(order => (
              <Link key={order.id} href={`/clients/${order.client?.id}`}>
                <div className="es-row justify-between">
                  <div className="min-w-0 mr-4">
                    <div className="font-semibold truncate">{order.client?.first_name} {order.client?.last_name}</div>
                    <div className="text-ink-muted text-[12px]">{order.garment_type}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={order.status} size="sm" />
                    {order.price && <span className="font-semibold">${order.price.toLocaleString()}</span>}
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>

        {/* ===== CARE ITEMS ===== */}
        {stats.careItemsDue.length > 0 && (
          <section>
            <div className="es-section-header">Care Items Due</div>
            {stats.careItemsDue.map(item => {
              const overdue = new Date(item.due_date) < new Date()
              return (
                <Link key={item.id} href={`/clients/${item.client?.id}`}>
                  <div className="es-row justify-between">
                    <div className="min-w-0 mr-4">
                      <div className="font-semibold truncate">{item.title}</div>
                      <div className="text-ink-muted text-[12px] truncate">{item.client?.first_name} {item.client?.last_name}</div>
                    </div>
                    <div className={`flex-shrink-0 font-semibold ${overdue ? 'text-error' : 'text-ink-secondary'}`}>
                      {overdue ? 'Overdue' : new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </Link>
              )
            })}
          </section>
        )}
      </div>
    </Layout>
  )
}

