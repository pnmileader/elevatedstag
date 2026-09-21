'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import { clientDisplayName, clientInitials } from '@/lib/clientDisplay'
import {
  daysSince,
  groupRecentOrders,
  lineTotal,
  localISODate,
  monthBounds,
  revenueBetween,
  type OrderGroup,
  type SaleLine,
} from '@/lib/dashboard'

interface ClientDeadline {
  id: string
  first_name: string
  last_name: string
  need_by_date: string
  need_by_description: string | null
}

interface ClientFollowUp {
  id: string
  first_name: string
  last_name: string
  last_contact_date: string
  stage: string
}

interface CareItemDue {
  id: string
  title: string
  due_date: string
  client: { id: string; first_name: string; last_name: string }
}

type StageCounts = { lead: number; active: number; vip: number; dormant: number }

interface DashboardStats {
  totalClients: number
  stageCounts: StageCounts
  ordersInProgress: number
  upcomingDeadlines: ClientDeadline[]
  recentOrders: OrderGroup[]
  careItemsDue: CareItemDue[]
  revenueThisMonth: number
  revenueLastMonth: number
  ordersThisMonth: number
  ordersLastMonth: number
  latestSaleDate: string | null
}

interface FollowUpData {
  clients: ClientFollowUp[]
  total: number
  neverContacted: number
}

type JoinedClient = { id: string; first_name: string | null; last_name: string | null }
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

const IN_PROGRESS_WINDOW_DAYS = 180
const FOLLOW_UP_OPTIONS = [30, 60, 90, 120, 180, 365]
const FOLLOW_UP_KEY = 'es.followUpDays'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [followUp, setFollowUp] = useState<FollowUpData | null>(null)
  const [followUpDays, setFollowUpDays] = useState<number>(() => {
    if (typeof window === 'undefined') return 90
    const saved = Number(window.localStorage.getItem(FOLLOW_UP_KEY))
    return FOLLOW_UP_OPTIONS.includes(saved) ? saved : 90
  })

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient()
      const now = new Date()
      const today = localISODate(now)
      const { lastMonthStart } = monthBounds(now)
      const inProgressCutoff = new Date(now)
      inProgressCutoff.setDate(inProgressCutoff.getDate() - IN_PROGRESS_WINDOW_DAYS)
      const careHorizon = new Date(now.getTime() + 14 * 86_400_000)

      const stageCount = (stage: string) =>
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('stage', stage)

      const [
        totalRes, leadRes, activeRes, vipRes, dormantRes,
        inProgressRes,
        deadlinesRes,
        careItemsRes,
        customSalesRes,
        readySalesRes,
        recentCustomRes,
        recentReadyRes,
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        stageCount('lead'), stageCount('active'), stageCount('vip'), stageCount('dormant'),
        // In progress = not delivered AND ordered recently. Imported history
        // lands as 'ordered', so a bare status check counted every old order.
        supabase
          .from('custom_orders')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'delivered')
          .gte('order_date', localISODate(inProgressCutoff)),
        supabase
          .from('clients')
          .select('id, first_name, last_name, need_by_date, need_by_description')
          .not('need_by_date', 'is', null)
          .gte('need_by_date', today)
          .order('need_by_date', { ascending: true })
          .limit(10),
        supabase
          .from('client_care_items')
          .select('id, title, due_date, client:clients(id, first_name, last_name)')
          .eq('completed', false)
          .not('due_date', 'is', null)
          .lte('due_date', localISODate(careHorizon))
          .order('due_date', { ascending: true })
          .limit(5),
        // Revenue = custom orders + ready-made purchases since the start of last month
        supabase.from('custom_orders').select('client_id, order_date, price').gte('order_date', lastMonthStart),
        supabase.from('ready_made_purchases').select('client_id, purchase_date, price, quantity').gte('purchase_date', lastMonthStart),
        supabase
          .from('custom_orders')
          .select('client_id, order_date, price, garment_type, status, client:clients(id, first_name, last_name)')
          .order('order_date', { ascending: false })
          .limit(60),
        supabase
          .from('ready_made_purchases')
          .select('client_id, purchase_date, price, quantity, product_name, category, client:clients(id, first_name, last_name)')
          .order('purchase_date', { ascending: false })
          .limit(60),
      ])

      const monthLines: SaleLine[] = [
        ...(customSalesRes.data || []).map((o) => ({
          client_id: o.client_id, date: o.order_date, amount: lineTotal(o.price), label: '', kind: 'custom' as const,
        })),
        ...(readySalesRes.data || []).map((p) => ({
          client_id: p.client_id, date: p.purchase_date, amount: lineTotal(p.price, p.quantity), label: '', kind: 'ready_made' as const,
        })),
      ]
      const { thisMonthStart, lastMonthEnd } = monthBounds(now)
      const thisMonth = revenueBetween(monthLines, thisMonthStart)
      const lastMonth = revenueBetween(monthLines, lastMonthStart, lastMonthEnd)

      const recentLines: SaleLine[] = [
        ...(recentCustomRes.data || []).map((o) => ({
          client_id: o.client_id, date: o.order_date, amount: lineTotal(o.price),
          label: o.garment_type || 'Custom order', kind: 'custom' as const, status: o.status,
          client: one(o.client as JoinedClient | JoinedClient[] | null),
        })),
        ...(recentReadyRes.data || []).map((p) => ({
          client_id: p.client_id, date: p.purchase_date, amount: lineTotal(p.price, p.quantity),
          label: p.product_name || p.category || 'Ready-made', kind: 'ready_made' as const,
          client: one(p.client as JoinedClient | JoinedClient[] | null),
        })),
      ]
      const latestSaleDate = recentLines.reduce<string | null>(
        (max, l) => (l.date && (!max || l.date > max) ? l.date : max), null)

      setStats({
        totalClients: totalRes.count || 0,
        stageCounts: {
          lead: leadRes.count || 0,
          active: activeRes.count || 0,
          vip: vipRes.count || 0,
          dormant: dormantRes.count || 0,
        },
        ordersInProgress: inProgressRes.count || 0,
        upcomingDeadlines: (deadlinesRes.data || []) as ClientDeadline[],
        recentOrders: groupRecentOrders(recentLines, 5),
        careItemsDue: (careItemsRes.data || []) as unknown as CareItemDue[],
        revenueThisMonth: thisMonth.revenue,
        revenueLastMonth: lastMonth.revenue,
        ordersThisMonth: thisMonth.orders,
        ordersLastMonth: lastMonth.orders,
        latestSaleDate,
      })
      setLoading(false)
    }

    fetchDashboardData()
  }, [])

  // Follow-up list: only clients with a real last-contact date older than the
  // chosen threshold. Clients with no contact on record are counted separately
  // instead of being shown as a fake "999 days".
  useEffect(() => {
    let cancelled = false
    async function fetchFollowUps() {
      const supabase = createClient()
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - followUpDays)
      const cutoffStr = localISODate(cutoff)

      const [listRes, countRes, neverRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, first_name, last_name, last_contact_date, stage')
          .not('last_contact_date', 'is', null)
          .lt('last_contact_date', cutoffStr)
          .order('last_contact_date', { ascending: true })
          .limit(5),
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .not('last_contact_date', 'is', null)
          .lt('last_contact_date', cutoffStr),
        supabase.from('clients').select('id', { count: 'exact', head: true }).is('last_contact_date', null),
      ])
      if (cancelled) return
      setFollowUp({
        clients: (listRes.data || []) as ClientFollowUp[],
        total: countRes.count || 0,
        neverContacted: neverRes.count || 0,
      })
    }
    fetchFollowUps()
    return () => { cancelled = true }
  }, [followUpDays])

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

  const now = new Date()
  const revenueChange = stats.revenueLastMonth > 0
    ? ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth * 100).toFixed(0)
    : stats.revenueThisMonth > 0 ? '100' : '0'
  const revenueUp = stats.revenueThisMonth >= stats.revenueLastMonth
  const dataAgeDays = stats.latestSaleDate ? daysSince(stats.latestSaleDate, now) : null
  const salesDataStale = dataAgeDays !== null && dataAgeDays > 35

  return (
    <Layout currentPage="dashboard" title="Dashboard">
      <div className="flex flex-col gap-4">

        {/* ===== REVENUE — first thing she looks at ===== */}
        <section>
          <div className="es-section-header">Revenue</div>
          <div className="grid grid-cols-3 gap-px bg-rule border border-rule">
            <div className="bg-surface" style={{ padding: '16px 20px' }}>
              <div className="es-label mb-1">This Month</div>
              <div className="es-metric revenue-amount" data-testid="revenue-this-month">{money(stats.revenueThisMonth)}</div>
              <div className="text-ink-muted text-[12px] mt-1">{stats.ordersThisMonth} order{stats.ordersThisMonth !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-surface" style={{ padding: '16px 20px' }}>
              <div className="es-label mb-1">Last Month</div>
              <div className="es-metric revenue-amount" data-testid="revenue-last-month">{money(stats.revenueLastMonth)}</div>
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
          {salesDataStale && stats.latestSaleDate && (
            <Link
              href="/settings/import"
              data-testid="sales-data-stale"
              className="flex items-center justify-between gap-3 border border-t-0 border-rule bg-surface-alt text-[13px] text-ink-secondary min-h-[44px]"
              style={{ padding: '8px 20px' }}
            >
              <span>
                Sales data only goes through{' '}
                <strong className="text-ink">
                  {new Date(`${stats.latestSaleDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </strong>
                . Import a newer QuickBooks export to bring revenue up to date.
              </span>
              <span className="text-gold font-semibold flex-shrink-0">Import &rarr;</span>
            </Link>
          )}
        </section>

        {/* ===== QUICK STATS ===== */}
        <div className="grid grid-cols-4 gap-px bg-rule border border-rule">
          <Link href="/clients" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">Clients</div>
            <div className="es-metric-sm" data-testid="stat-total-clients">{stats.totalClients}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/orders" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">In Progress</div>
            <div className={`es-metric-sm ${stats.ordersInProgress > 0 ? 'text-gold' : ''}`} data-testid="stat-in-progress">{stats.ordersInProgress}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/clients?stage=vip" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">VIP</div>
            <div className="es-metric-sm" data-testid="stat-vip">{stats.stageCounts.vip}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
          <Link href="/clients?stage=active" className="bg-surface active:bg-surface-alt" style={{ padding: '12px 20px' }}>
            <div className="es-label mb-0.5">Active</div>
            <div className="es-metric-sm" data-testid="stat-active">{stats.stageCounts.active}</div>
            <span className="text-ink-muted text-[10px] mt-1">&rarr;</span>
          </Link>
        </div>

        {/* ===== CLIENTS BY STAGE — one-tap filters ===== */}
        <section>
          <div className="es-section-header">Clients by Stage</div>
          <div className="flex flex-wrap gap-2" style={{ padding: '8px 20px 4px' }} data-testid="stage-filters">
            {(['active', 'vip', 'lead', 'dormant'] as const).map((stage) => (
              <Link
                key={stage}
                href={`/clients?stage=${stage}`}
                className="es-chip"
                data-testid={`stage-filter-${stage}`}
              >
                <span className="capitalize">{stage === 'vip' ? 'VIP' : stage}</span>
                <span className="es-chip-count">{stats.stageCounts[stage]}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ===== DEADLINES ===== */}
        {stats.upcomingDeadlines.length > 0 && (
          <section>
            <div className="es-section-header">
              Deadlines <span className="text-error ml-1 normal-case tracking-normal">{stats.upcomingDeadlines.length}</span>
            </div>
            {stats.upcomingDeadlines.map(client => {
              const daysLeft = Math.ceil((new Date(client.need_by_date).getTime() - now.getTime()) / 86_400_000)
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
        <section data-testid="follow-up">
          <div className="es-section-header justify-between">
            <span>
              Needs Follow-Up{' '}
              {followUp && <span className="text-warning ml-1 normal-case tracking-normal">{followUp.total}</span>}
            </span>
            <label className="flex items-center gap-2 normal-case tracking-normal font-normal text-[12px] text-ink-secondary">
              No contact in
              <select
                value={followUpDays}
                data-testid="follow-up-days"
                onChange={(e) => {
                  const days = Number(e.target.value)
                  setFollowUpDays(days)
                  try { window.localStorage.setItem(FOLLOW_UP_KEY, String(days)) } catch { /* private mode */ }
                }}
                className="h-[36px] px-2 border border-rule rounded bg-surface text-ink text-[13px]"
              >
                {FOLLOW_UP_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d === 365 ? '1 year' : `${d} days`}</option>
                ))}
              </select>
            </label>
          </div>
          {!followUp ? (
            <div className="py-4 px-5 text-ink-muted text-[13px]">Loading…</div>
          ) : followUp.clients.length === 0 ? (
            <div className="py-4 px-5 text-ink-muted text-[13px]">
              Everyone has been contacted in the last {followUpDays} days.
            </div>
          ) : (
            followUp.clients.map(client => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="es-row justify-between" data-testid="follow-up-row">
                  <div className="flex items-center gap-3 min-w-0 mr-4">
                    <div className="es-avatar">{clientInitials(client)}</div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{clientDisplayName(client)}</div>
                      <div className="text-ink-muted text-[12px]">
                        Last contact {new Date(`${client.last_contact_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 font-semibold text-warning">
                    {daysSince(client.last_contact_date, now)}d
                  </div>
                </div>
              </Link>
            ))
          )}
          {followUp && followUp.total > followUp.clients.length && (
            <Link href="/clients?sort=last_contact" className="es-row text-[13px] text-gold font-semibold">
              View all {followUp.total} &rarr;
            </Link>
          )}
          {followUp && followUp.neverContacted > 0 && (
            <Link href="/clients?contact=never" className="es-row text-[13px] text-ink-secondary" data-testid="never-contacted">
              <span>Never contacted</span>
              <span className="font-semibold">{followUp.neverContacted} client{followUp.neverContacted !== 1 ? 's' : ''} &rarr;</span>
            </Link>
          )}
        </section>

        {/* ===== RECENT ORDERS — one row per client per order date ===== */}
        <section data-testid="recent-orders">
          <div className="es-section-header flex items-center justify-between">
            <span>Recent Orders</span>
            <Link href="/orders" className="es-btn-ghost normal-case tracking-normal">View All</Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="py-4 px-5 text-ink-muted text-[13px]">No recent orders.</div>
          ) : (
            stats.recentOrders.map(order => (
              <Link key={order.key} href={`/clients/${order.client?.id}`}>
                <div className="es-row justify-between" data-testid="recent-order-row">
                  <div className="min-w-0 mr-4">
                    <div className="font-semibold truncate">{clientDisplayName(order.client)}</div>
                    <div className="text-ink-muted text-[12px] truncate">
                      {new Date(`${order.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {order.labels.slice(0, 3).join(', ')}{order.labels.length > 3 ? ` +${order.labels.length - 3} more` : ''}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-semibold">{money(order.total)}</div>
                    <div className="text-ink-muted text-[12px]">{order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</div>
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
              const overdue = new Date(item.due_date) < now
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
