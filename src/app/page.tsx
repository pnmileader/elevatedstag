'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  Clock,
  TrendingUp,
  Package,
  AlertCircle,
  CheckCircle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Truck,
  UserX,
  Gift,
  Star,
  PackageCheck
} from 'lucide-react'
import Layout from '@/components/Layout'
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
    fetchDashboardData()
  }, [])

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
      recentOrders: recentOrders as RecentOrder[],
      careItemsDue: careItems as CareItemDue[],
      revenueThisMonth,
      revenueLastMonth,
      ordersThisMonth: ordersThisMonth.length,
      ordersLastMonth: ordersLastMonth.length,
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-gold mx-auto mb-4" />
            <p className="font-body text-gray-dark text-sm">Loading dashboard...</p>
          </div>
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
      <div className="space-y-10">
        {/* Page Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Dashboard</h1>
            <p className="font-body text-gray-dark mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Link
            href="/clients/new"
            className="bg-[#2D2D2D] hover:bg-[#404040] text-white px-5 py-2.5 rounded-lg font-body font-medium text-sm transition-colors hidden lg:inline-flex items-center gap-2"
          >
            + New Client
          </Link>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Clients"
            value={stats.totalClients}
            icon={<Users className="w-6 h-6" />}
            href="/clients"
          />
          <StatCard
            title="Orders In Progress"
            value={stats.ordersInProgress}
            icon={<Clock className="w-6 h-6" />}
            href="/orders"
            highlight={stats.ordersInProgress > 0}
          />
          <StatCard
            title="VIP Clients"
            value={stats.vipClients}
            icon={<Star className="w-6 h-6" />}
            href="/clients?stage=vip"
          />
          <StatCard
            title="Active Clients"
            value={stats.activeClients}
            icon={<CheckCircle className="w-6 h-6" />}
            href="/clients?stage=active"
          />
        </div>

        {/* Revenue Snapshot */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-base font-medium text-[#2D2D2D]">
              Revenue Snapshot
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-light rounded-xl p-5 lg:p-6">
              <p className="font-body text-sm text-gray-dark mb-1">This Month</p>
              <p className="font-heading text-3xl lg:text-4xl font-light text-[#2D2D2D]">
                ${stats.revenueThisMonth.toLocaleString()}
              </p>
              <p className="font-body text-sm text-gray-dark mt-2">
                {stats.ordersThisMonth} order{stats.ordersThisMonth !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-gray-light rounded-xl p-5 lg:p-6">
              <p className="font-body text-sm text-gray-dark mb-1">Last Month</p>
              <p className="font-heading text-3xl lg:text-4xl font-light text-[#2D2D2D]">
                ${stats.revenueLastMonth.toLocaleString()}
              </p>
              <p className="font-body text-sm text-gray-dark mt-2">
                {stats.ordersLastMonth} order{stats.ordersLastMonth !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-gray-light rounded-xl p-5 lg:p-6">
              <p className="font-body text-sm text-gray-dark mb-1">Change</p>
              <div className="flex items-center gap-2">
                {revenueUp ? (
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5 text-red-500" />
                  </div>
                )}
                <p className={`font-heading text-3xl lg:text-4xl font-light ${revenueUp ? 'text-green-600' : 'text-red-500'}`}>
                  {revenueUp ? '+' : ''}{revenueChange}%
                </p>
              </div>
              <p className="font-body text-sm text-gray-dark mt-2">
                vs last month
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines + Needs Follow-Up */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Upcoming Deadlines */}
          {stats.upcomingDeadlines.length > 0 && (
            <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-base font-medium text-[#2D2D2D]">
                  Upcoming Deadlines
                </h2>
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full font-body text-sm font-medium">
                  {stats.upcomingDeadlines.length}
                </span>
              </div>
              <div className="space-y-3">
                {stats.upcomingDeadlines.map(client => {
                  const daysLeft = Math.ceil((new Date(client.need_by_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysLeft <= 14
                  return (
                    <Link key={client.id} href={`/clients/${client.id}`} className="block">
                      <div className={`flex items-center justify-between p-4 rounded-xl transition-colors ${isUrgent ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-light hover:bg-gray-light'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isUrgent ? 'bg-red-100' : 'bg-gold/10'}`}>
                            <AlertCircle className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-gold'}`} />
                          </div>
                          <div>
                            <p className="font-body font-medium">{client.first_name} {client.last_name}</p>
                            <p className="font-body text-sm text-gray-dark">{client.need_by_description || 'Deadline'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-body text-sm font-medium ${isUrgent ? 'text-red-500' : 'text-gold'}`}>
                            {daysLeft}d left
                          </p>
                          <p className="font-body text-xs text-gray-dark">
                            {new Date(client.need_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Clients Needing Follow-Up */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-base font-medium text-[#2D2D2D]">
                Needs Follow-Up
              </h2>
              {stats.clientsNeedingFollowUp.length > 0 && (
                <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-body text-sm font-medium">
                  {stats.clientsNeedingFollowUp.length}+
                </span>
              )}
            </div>

            {stats.clientsNeedingFollowUp.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="font-body text-gray-dark">All clients are up to date!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.clientsNeedingFollowUp.map(client => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 bg-gray-light rounded-xl hover:bg-orange-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <span className="font-heading font-medium text-orange-600 text-sm">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-body font-medium">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="font-body text-sm text-gray-dark capitalize">
                            {client.stage} client
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-body text-sm font-medium text-orange-600">
                          {client.daysSinceContact === 999 ? 'Never' : `${client.daysSinceContact}d`}
                        </p>
                        <p className="font-body text-xs text-gray-dark">
                          since contact
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Care Items Due + Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Care Items Due */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-base font-medium text-[#2D2D2D]">
                Care Items Due
              </h2>
            </div>

            {stats.careItemsDue.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="font-body text-gray-dark">No care items due soon</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.careItemsDue.map(item => {
                  const isOverdue = new Date(item.due_date) < new Date()
                  return (
                    <Link
                      key={item.id}
                      href={`/clients/${item.client?.id}`}
                      className="block"
                    >
                      <div className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                        isOverdue ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-light hover:bg-gray-light'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isOverdue ? 'bg-red-100' : 'bg-gold/10'
                          }`}>
                            <CheckCircle className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-gold'}`} />
                          </div>
                          <div>
                            <p className="font-body font-medium">{item.title}</p>
                            <p className="font-body text-sm text-gray-dark">
                              {item.client?.first_name} {item.client?.last_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-body text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gold'}`}>
                            {isOverdue ? 'Overdue' : new Date(item.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-base font-medium text-[#2D2D2D]">
                Recent Orders
              </h2>
              <Link href="/orders" className="text-gold hover:text-gold-light font-body text-sm font-medium">
                View All
              </Link>
            </div>

            {stats.recentOrders.length === 0 ? (
              <p className="font-body text-gray-dark py-4">No recent orders</p>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map(order => (
                  <Link
                    key={order.id}
                    href={`/clients/${order.client?.id}`}
                    className="block"
                  >
                    <div className="p-4 bg-gray-light rounded-xl hover:bg-gray-light transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-gold" />
                          </div>
                          <div>
                            <p className="font-body font-medium text-sm">
                              {order.client?.first_name} {order.client?.last_name}
                            </p>
                            <p className="font-body text-xs text-gray-dark mt-0.5">
                              {order.garment_type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={order.status} />
                          <div className="flex items-center gap-2 mt-1">
                            {order.price && (
                              <span className="font-body text-sm font-medium text-[#2D2D2D]">${order.price.toLocaleString()}</span>
                            )}
                            <span className="font-body text-xs text-gray-dark">
                              {new Date(order.order_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function StatCard({
  title,
  value,
  icon,
  href,
  highlight = false,
}: {
  title: string
  value: number
  icon: React.ReactNode
  href: string
  highlight?: boolean
}) {
  return (
    <Link href={href}>
      <div
        className="bg-white rounded-2xl p-5 lg:p-6 border border-gray-med transition-all h-full hover:shadow-md"
        style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-gray-dark mb-1">{title}</p>
            <p className="font-heading text-4xl font-light text-[#2D2D2D]">{value}</p>
          </div>
          <div className="w-12 h-12 bg-gray-light rounded-xl flex items-center justify-center text-gold flex-shrink-0">
            {icon}
          </div>
        </div>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    ordered: { bg: 'bg-gray-200', text: 'text-gray-700' },
    blue_pencil: { bg: 'bg-purple-100', text: 'text-purple-700' },
    cutting: { bg: 'bg-blue-100', text: 'text-blue-700' },
    sewing: { bg: 'bg-orange-100', text: 'text-orange-700' },
    shipping: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700' },
  }

  const config = statusConfig[status] || statusConfig.ordered

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${config.bg} ${config.text}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
