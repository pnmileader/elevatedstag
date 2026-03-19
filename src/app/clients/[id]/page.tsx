import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Edit, ExternalLink, CalendarPlus, StickyNote, Receipt, Shirt, Ruler, Package, ShoppingBag, Camera, Heart, Users as UsersIcon, PawPrint, MessageCircle } from 'lucide-react'
import { notFound } from 'next/navigation'
import CareItemsCard from '@/components/CareItemsCard'
import ActivityTimeline from '@/components/ActivityTimeline'
import FinancialSummary from '@/components/FinancialSummary'
import ClientPhotosGallery from '@/components/ClientPhotosGallery'
import StatusBadge from '@/components/StatusBadge'
import Layout from '@/components/Layout'

type UpcomingEvent = { event: string; date: string }

type Client = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  billing_address: { street?: string; city?: string; state?: string; zip?: string } | null
  stage: 'lead' | 'active' | 'vip' | 'dormant'
  source: string | null
  notes: string | null
  preferences: string | null
  first_contact_date: string | null
  last_contact_date: string | null
  birthday: string | null
  quickbooks_id: string | null
  // Personal details
  spouse_partner: string | null
  children: string | null
  pets: string | null
  birthday_month: string | null
  communication_preference: string | null
  shopping_habits: string | null
  general_style: string | null
  style_likes: string | null
  style_dislikes: string | null
  brand_preferences: string | null
  upcoming_events: UpcomingEvent[] | null
  location_tags: string[] | null
  referred_by: string | null
  contact_type: string | null
  need_by_date: string | null
  need_by_description: string | null
  trinity_id: string | null
}

type Measurement = {
  id: string
  category: string
  measurements: Record<string, string>
  source: string
}

type CustomOrder = {
  id: string
  order_date: string
  garment_type: string
  fabric_name: string | null
  fabric_code: string | null
  price: number | null
  status: string
  eta_start: string | null
  eta_end: string | null
}

type CareItem = {
  id: string
  client_id: string
  item_type: string
  title: string
  completed: boolean
  completed_at: string | null
  due_date: string | null
}

type ReadyMadePurchase = {
  id: string
  category: string
  brand: string | null
  product_name: string
  description: string | null
  size: string | null
  price: number | null
  quantity: number
  purchase_date: string | null
}

async function getClientData(id: string) {
  const supabase = await createServerSupabaseClient()

  const [clientRes, measurementsRes, ordersRes, careItemsRes, purchasesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('measurements').select('*').eq('client_id', id),
    supabase.from('custom_orders').select('*').eq('client_id', id).order('order_date', { ascending: false }),
    supabase.from('client_care_items').select('*').eq('client_id', id),
    supabase.from('ready_made_purchases').select('*').eq('client_id', id).order('purchase_date', { ascending: false }),
  ])

  return {
    client: clientRes.data as Client | null,
    measurements: (measurementsRes.data || []) as Measurement[],
    orders: (ordersRes.data || []) as CustomOrder[],
    careItems: (careItemsRes.data || []) as CareItem[],
    purchases: (purchasesRes.data || []) as ReadyMadePurchase[],
  }
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { client, measurements, orders, careItems, purchases } = await getClientData(id)

  if (!client) {
    notFound()
  }

  const initials = `${client.first_name[0]}${client.last_name[0]}`
  const fullName = `${client.first_name} ${client.last_name}`

  const stageColors = {
    vip: 'bg-gold',
    active: 'bg-green-500',
    lead: 'bg-blue-500',
    dormant: 'bg-gray-dark',
  }

  const orderSpend = orders.reduce((sum, order) => sum + (order.price || 0), 0)
  const purchaseSpend = purchases.reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 1)), 0)
  const totalSpend = orderSpend + purchaseSpend
  const ordersInProgress = orders.filter(o => o.status !== 'delivered').length

  // Get most recent order date and items
  const recentOrderDate = orders.length > 0 ? orders[0].order_date : null
  const recentOrders = recentOrderDate
    ? orders.filter(o => o.order_date === recentOrderDate)
    : []
  const recentPurchases = purchases.length > 0 && purchases[0].purchase_date
    ? purchases.filter(p => p.purchase_date === purchases[0].purchase_date)
    : []

  // Key measurements for header
  const coatMeasurements = measurements.find(m => m.category === 'coat')
  const pantMeasurements = measurements.find(m => m.category === 'pant')
  const shirtMeasurements = measurements.find(m => m.category === 'shirt')

  const commPrefIcon = {
    text: MessageCircle,
    call: Phone,
    email: Mail,
  }

  return (
    <Layout currentPage="clients" showSearch={true} showNewClient={true} showTrinity={true}>
      {/* Back Button & Profile Header */}
      <div className="bg-white border-b border-gray-med">
        <div className="max-w-6xl mx-auto px-3 py-4 pb-6">
          <Link href="/clients" className="inline-flex items-center gap-2 text-gray-dark hover:text-body mb-4 font-body text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 bg-gold rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white font-heading font-bold text-3xl">{initials}</span>
              </div>
              <div>
                <h1 className="font-heading text-lg font-medium text-body">{fullName}</h1>
                <div className="flex items-center gap-4 mt-2 text-gray-dark font-body text-sm">
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {client.phone}
                    </span>
                  )}
                  {client.communication_preference && (
                    <span className="flex items-center gap-1 text-gray-dark">
                      <MessageCircle className="w-3.5 h-3.5" />
                      Prefers {client.communication_preference}
                    </span>
                  )}
                </div>
                {client.billing_address && (
                  <div className="flex items-center gap-1 mt-1 text-gray-dark font-body text-sm">
                    <MapPin className="w-4 h-4" />
                    {[client.billing_address.street, client.billing_address.city, client.billing_address.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {client.referred_by && (
                  <p className="font-body text-sm text-gray-dark mt-1">
                    Referred by {client.referred_by}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={`inline-block px-3 py-1 rounded text-[11px] font-medium uppercase tracking-wide text-white whitespace-nowrap ${stageColors[client.stage]}`}>
                    {client.stage} Client
                  </span>
                  {client.contact_type === 'referral' && (
                    <span className="inline-block px-3 py-1 rounded text-[11px] font-medium uppercase tracking-wide text-white whitespace-nowrap bg-purple-500">
                      Referral
                    </span>
                  )}
                  {client.spouse_partner && (
                    <span className="text-gray-dark font-body text-xs flex items-center gap-1">
                      <Heart className="w-3 h-3 text-gray-dark" />
                      {client.spouse_partner}
                    </span>
                  )}
                  {client.birthday_month && (
                    <span className="text-gray-dark font-body text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-dark" />
                      {client.birthday_month}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link
              href={`/clients/${client.id}/edit`}
              className="w-full sm:w-auto border border-gray-med text-body hover:border-gold px-4 py-2 rounded font-body text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Client
            </Link>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 mt-5 pb-2 overflow-x-auto">
            <Link
              href={`/calendar/new?client=${client.id}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-med text-body hover:border-gold hover:text-gold rounded font-body text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Schedule
            </Link>
            <Link
              href={`/email?client=${client.id}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-med text-body hover:border-gold hover:text-gold rounded font-body text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </Link>
            <Link
              href={`/clients/${client.id}/edit#notes`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-med text-body hover:border-gold hover:text-gold rounded font-body text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <StickyNote className="w-3.5 h-3.5" />
              Add Note
            </Link>
            {client.quickbooks_id && (
              <a
                href={`https://app.qbo.intuit.com/app/customerdetail?nameId=${client.quickbooks_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-gray-med text-body hover:border-gold hover:text-gold rounded font-body text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Receipt className="w-3.5 h-3.5" />
                QuickBooks
              </a>
            )}
            {client.trinity_id ? (
              <a
                href={`https://dealer.trinity-apparel.com/clients/${client.trinity_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-gray-med text-body hover:border-gold hover:text-gold rounded font-body text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Shirt className="w-3.5 h-3.5" />
                View in Trinity
              </a>
            ) : (
              <span
                className="flex items-center gap-2 px-4 py-2 border border-gray-med text-muted rounded font-body text-xs font-semibold cursor-not-allowed whitespace-nowrap"
                title="Add Trinity ID in client settings"
              >
                <Shirt className="w-3.5 h-3.5" />
                View in Trinity
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-3 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-3">

            {/* Financial Summary */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <h2 className="font-heading text-sm font-medium text-body mb-2">Financial Summary</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-2">
                <div className="text-center p-3 lg:p-4 bg-gray-light rounded">
                  <p className="font-heading text-xl lg:text-lg font-light text-body">${totalSpend.toLocaleString()}</p>
                  <p className="font-body text-xs lg:text-sm text-gray-dark mt-1">In CRM</p>
                </div>
                <div className="text-center p-3 lg:p-4 bg-gray-light rounded">
                  <p className="font-heading text-xl lg:text-lg font-light text-body">{orders.length + purchases.length}</p>
                  <p className="font-body text-xs lg:text-sm text-gray-dark mt-1">Total Items</p>
                </div>
                <div className="text-center p-3 lg:p-4 bg-gray-light rounded">
                  <p className="font-heading text-xl lg:text-lg font-light text-body">{ordersInProgress}</p>
                  <p className="font-body text-xs lg:text-sm text-gray-dark mt-1">In Progress</p>
                </div>
                <div className="text-center p-3 lg:p-4 bg-gray-light rounded">
                  <p className="font-heading text-xl lg:text-lg font-light text-body">{orders.length}</p>
                  <p className="font-body text-xs lg:text-sm text-gray-dark mt-1">Custom Orders</p>
                </div>
              </div>
            </div>

            {/* Recent Order Summary */}
            {(recentOrders.length > 0 || recentPurchases.length > 0) && (
              <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-sm font-medium text-body flex items-center gap-2">
                    <Package className="w-5 h-5 text-gold" />
                    Most Recent Order
                  </h2>
                  {recentOrderDate && (
                    <span className="font-body text-sm text-gray-dark">
                      {new Date(recentOrderDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link key={order.id} href={`/clients/${client.id}/orders/${order.id}/edit`}>
                      <div className="flex items-center justify-between p-4 bg-gray-light rounded hover:bg-gray-med transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-body text-[9px] font-bold text-center leading-tight">
                              {order.fabric_code || order.garment_type.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-body font-semibold">{order.garment_type}</p>
                            <p className="font-body text-sm text-gray-dark">{order.fabric_name || 'No fabric specified'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={order.status} />
                          {order.price && (
                            <p className="font-body font-semibold mt-1">${order.price.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {recentPurchases.map((purchase) => (
                    <Link key={purchase.id} href={`/clients/${client.id}/purchases/${purchase.id}/edit`}>
                      <div className="flex items-center justify-between p-4 bg-gray-light rounded hover:bg-gray-med transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-body font-semibold">
                              {purchase.brand && `${purchase.brand} `}{purchase.product_name}
                            </p>
                            <p className="font-body text-sm text-gray-dark">
                              {[purchase.description, purchase.size && `Size: ${purchase.size}`].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-3 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                            Ready-Made
                          </span>
                          {purchase.price && (
                            <p className="font-body font-semibold mt-1">${purchase.price.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  <div className="pt-2 border-t border-gray-light flex items-center justify-between">
                    <span className="font-body text-sm text-gray-dark">
                      {recentOrders.length + recentPurchases.length} item{recentOrders.length + recentPurchases.length !== 1 ? 's' : ''} in this order
                    </span>
                    <span className="font-heading text-lg font-medium text-body">
                      ${(recentOrders.reduce((s, o) => s + (o.price || 0), 0) + recentPurchases.reduce((s, p) => s + ((p.price || 0) * (p.quantity || 1)), 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Measurements Preview */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-sm font-medium text-body">Measurements</h2>
                <Link
                  href={`/clients/${client.id}/measurements`}
                  className="text-gray-dark hover:text-body font-body text-sm font-medium"
                >
                  View All / Edit
                </Link>
              </div>
              {measurements.length === 0 ? (
                <p className="text-gray-dark font-body">No measurements recorded yet.</p>
              ) : (
                <div>
                  {/* Key measurements highlight */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                    {[
                      { label: 'Neck', value: shirtMeasurements?.measurements?.neck },
                      { label: 'Chest', value: coatMeasurements?.measurements?.skin_chest },
                      { label: 'Coat Waist', value: coatMeasurements?.measurements?.skin_coat_waist },
                      { label: 'Waist', value: pantMeasurements?.measurements?.waist },
                      { label: 'Seat', value: pantMeasurements?.measurements?.seat },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-2 bg-gray-light border border-gray-med rounded">
                        <p className="font-heading text-lg font-medium text-body">{value || '\u2014'}</p>
                        <p className="font-body text-[10px] text-gray-dark uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {measurements.slice(0, 4).map((m) => {
                      const entries = Object.entries(m.measurements).slice(0, 3)
                      return (
                        <Link key={m.id} href={`/clients/${client.id}/measurements`}>
                          <div className="hover:bg-gray-med rounded p-2 transition-colors cursor-pointer">
                            <h3 className="font-heading font-semibold capitalize text-gold text-sm mb-1">{m.category}</h3>
                            {entries.map(([key, value]) => (
                              <p key={key} className="font-body text-xs text-gray-dark">
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>: <span className="font-semibold text-black">{value}</span>
                              </p>
                            ))}
                            {Object.entries(m.measurements).length > 3 && (
                              <p className="font-body text-xs text-gray-dark mt-1">+{Object.entries(m.measurements).length - 3} more</p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Orders */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-sm font-medium text-body">Custom Orders</h2>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/clients/${client.id}/swatches`}
                    className="text-gray-dark hover:text-body font-body text-sm font-medium"
                  >
                    Swatch Gallery
                  </Link>
                  <Link
                    href={`/clients/${client.id}/orders`}
                    className="text-gray-dark hover:text-body font-body text-sm font-medium"
                  >
                    + Add Order
                  </Link>
                </div>
              </div>
              {orders.length === 0 ? (
                <p className="text-gray-dark font-body">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} clientId={client.id} />
                  ))}
                </div>
              )}
            </div>

            {/* Ready-Made Purchases */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-sm font-medium text-body">Ready-Made Purchases</h2>
                <Link
                  href={`/clients/${client.id}/purchases/new`}
                  className="text-gray-dark hover:text-body font-body text-sm font-medium"
                >
                  + Add Purchase
                </Link>
              </div>
              {purchases.length === 0 ? (
                <p className="text-gray-dark font-body text-sm">No ready-made purchases yet.</p>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <PurchaseRow key={purchase.id} purchase={purchase} clientId={client.id} />
                  ))}
                </div>
              )}
            </div>

            {/* Client Photos */}
            <ClientPhotosGallery clientId={client.id} />
          </div>

          {/* Right Column */}
          <div className="space-y-3">

            {/* Personal Details Card */}
            {(client.spouse_partner || client.children || client.pets || client.birthday_month || client.shopping_habits || client.upcoming_events?.length) && (
              <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
                <h2 className="font-heading text-sm font-medium text-body mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-gold" />
                  Personal Details
                </h2>
                <div className="space-y-3 font-body text-sm">
                  {client.spouse_partner && (
                    <div className="flex items-start gap-3">
                      <Heart className="w-4 h-4 text-gray-dark mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-dark text-[11px] uppercase tracking-[0.05em]">Spouse/Partner</p>
                        <p className="font-semibold">{client.spouse_partner}</p>
                      </div>
                    </div>
                  )}
                  {client.children && (
                    <div className="flex items-start gap-3">
                      <UsersIcon className="w-4 h-4 text-gray-dark mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-dark text-[11px] uppercase tracking-[0.05em]">Children</p>
                        <p className="font-semibold">{client.children}</p>
                      </div>
                    </div>
                  )}
                  {client.pets && (
                    <div className="flex items-start gap-3">
                      <PawPrint className="w-4 h-4 text-gray-dark mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-dark text-[11px] uppercase tracking-[0.05em]">Pets</p>
                        <p className="font-semibold">{client.pets}</p>
                      </div>
                    </div>
                  )}
                  {client.shopping_habits && (
                    <div className="flex items-start gap-3">
                      <ShoppingBag className="w-4 h-4 text-gray-dark mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-dark text-[11px] uppercase tracking-[0.05em]">Shopping</p>
                        <p className="font-semibold capitalize">{client.shopping_habits.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  )}
                  {client.upcoming_events && client.upcoming_events.length > 0 && (
                    <div className="pt-3 border-t border-gray-light">
                      <p className="text-gray-dark text-[11px] uppercase tracking-[0.05em] mb-2 font-semibold">Upcoming Events</p>
                      {client.upcoming_events.map((evt, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5">
                          <span>{evt.event}</span>
                          {evt.date && (
                            <span className="text-gray-dark text-xs font-medium">
                              {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Style Preferences Card */}
            {(client.general_style || client.style_likes || client.style_dislikes || client.brand_preferences) && (
              <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
                <h2 className="font-heading text-sm font-medium text-body mb-4">Style Profile</h2>
                <div className="space-y-3">
                  {client.general_style && (
                    <div>
                      <p className="font-body text-xs text-gray-dark font-semibold mb-1">General Style</p>
                      <p className="font-body text-sm leading-relaxed">{client.general_style}</p>
                    </div>
                  )}
                  {client.style_likes && (
                    <div>
                      <p className="font-body text-xs text-green-600 font-semibold mb-1">Likes</p>
                      <p className="font-body text-sm leading-relaxed">{client.style_likes}</p>
                    </div>
                  )}
                  {client.style_dislikes && (
                    <div>
                      <p className="font-body text-xs text-red-500 font-semibold mb-1">Dislikes</p>
                      <p className="font-body text-sm leading-relaxed">{client.style_dislikes}</p>
                    </div>
                  )}
                  {client.brand_preferences && (
                    <div>
                      <p className="font-body text-xs text-gold font-semibold mb-1">Brand Preferences</p>
                      <p className="font-body text-sm leading-relaxed">{client.brand_preferences}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* QuickBooks Financial Data */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <FinancialSummary clientId={client.id} />
            </div>

            {/* Client Care Checklist */}
            <CareItemsCard clientId={client.id} initialItems={careItems} />

            {/* Notes */}
            {(client.notes || client.preferences) && (
              <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
                <h2 className="font-heading text-sm font-medium text-body mb-4">Notes & Preferences</h2>
                {client.notes && (
                  <div className="mb-4">
                    <h3 className="font-body text-sm font-semibold text-gray-dark mb-2">Notes</h3>
                    <p className="font-body text-sm leading-relaxed">{client.notes}</p>
                  </div>
                )}
                {client.preferences && (
                  <div>
                    <h3 className="font-body text-sm font-semibold text-gray-dark mb-2">Style Preferences</h3>
                    <p className="font-body text-sm leading-relaxed">{client.preferences}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Links */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <h3 className="font-heading text-sm font-medium text-body mb-4">Quick Links</h3>
              <div className="space-y-3">
                <Link href={`/clients/${client.id}/measurements`} className="flex items-center gap-4 p-3 rounded hover:bg-gray-med transition-colors group">
                  <div className="w-8 h-8 bg-gray-light rounded flex items-center justify-center">
                    <Ruler className="w-4 h-4 text-gold" />
                  </div>
                  <span className="font-body text-sm group-hover:text-gold transition-colors">Edit Measurements</span>
                </Link>
                <Link href={`/clients/${client.id}/swatches`} className="flex items-center gap-4 p-3 rounded hover:bg-gray-med transition-colors group">
                  <div className="w-8 h-8 bg-gray-light rounded flex items-center justify-center">
                    <Shirt className="w-4 h-4 text-gold" />
                  </div>
                  <span className="font-body text-sm group-hover:text-gold transition-colors">Fabric Swatches</span>
                </Link>
                <Link href={`/clients/${client.id}/orders`} className="flex items-center gap-4 p-3 rounded hover:bg-gray-med transition-colors group">
                  <div className="w-8 h-8 bg-gray-light rounded flex items-center justify-center">
                    <Package className="w-4 h-4 text-gold" />
                  </div>
                  <span className="font-body text-sm group-hover:text-gold transition-colors">Manage Custom Orders</span>
                </Link>
                <Link href={`/clients/${client.id}/purchases`} className="flex items-center gap-4 p-3 rounded hover:bg-gray-med transition-colors group">
                  <div className="w-8 h-8 bg-gray-light rounded flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-gold" />
                  </div>
                  <span className="font-body text-sm group-hover:text-gold transition-colors">Ready-Made Purchases</span>
                </Link>
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
              <h2 className="font-heading text-sm font-medium text-body mb-2">Quick Info</h2>
              <div className="space-y-3 font-body text-sm">
                {client.source && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Source</span>
                    <span className="font-semibold capitalize">{client.source}</span>
                  </div>
                )}
                {client.first_contact_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Client Since</span>
                    <span className="font-semibold">{new Date(client.first_contact_date).toLocaleDateString()}</span>
                  </div>
                )}
                {client.last_contact_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Last Contact</span>
                    <span className="font-semibold">{new Date(client.last_contact_date).toLocaleDateString()}</span>
                  </div>
                )}
                {client.birthday && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Birthday</span>
                    <span className="font-semibold">{new Date(client.birthday).toLocaleDateString()}</span>
                  </div>
                )}
                {client.need_by_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Need By</span>
                    <span className="font-semibold">
                      {new Date(client.need_by_date).toLocaleDateString()}
                      {client.need_by_description && ` \u2014 ${client.need_by_description}`}
                    </span>
                  </div>
                )}
                {client.referred_by && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-dark">Referred By</span>
                    <span className="font-semibold">{client.referred_by}</span>
                  </div>
                )}
                {client.location_tags && client.location_tags.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-dark">Locations</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {client.location_tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-light text-body rounded text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <ActivityTimeline clientId={client.id} />
          </div>
        </div>
      </div>
    </Layout>
  )
}


function OrderRow({ order, clientId }: { order: CustomOrder; clientId: string }) {
  const statusColors: Record<string, string> = {
    ordered: 'bg-gray-med text-gray-dark',
    blue_pencil: 'bg-purple-100 text-purple-700',
    cutting: 'bg-blue-100 text-blue-700',
    sewing: 'bg-orange-100 text-orange-700',
    shipping: 'bg-green-100 text-green-700',
    delivered: 'bg-green-500 text-white',
  }

  return (
    <Link href={`/clients/${clientId}/orders/${order.id}/edit`}>
      <div className="flex items-center justify-between p-4 bg-gray-light rounded hover:bg-gray-med transition-colors cursor-pointer">
        <div className="min-w-0 flex-1 pr-4">
          <p className="font-body font-semibold">{order.garment_type}</p>
          <p className="font-body text-sm text-gray-dark">{order.fabric_name || 'No fabric specified'}</p>
          <p className="font-body text-xs text-gray-dark mt-1">{new Date(order.order_date).toLocaleDateString()}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`inline-block px-3 py-1.5 rounded text-xs font-semibold uppercase ${statusColors[order.status] || statusColors.ordered}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
          {order.price && (
            <p className="font-body font-semibold mt-2">${order.price.toLocaleString()}</p>
          )}
          {order.eta_start && order.eta_end && order.status !== 'delivered' && (
            <p className="font-body text-xs text-gray-dark mt-1">
              ETA: {new Date(order.eta_start).toLocaleDateString()} - {new Date(order.eta_end).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function PurchaseRow({ purchase, clientId }: { purchase: ReadyMadePurchase; clientId: string }) {
  const categoryIcons: Record<string, string> = {
    shoes: '\u{1F45E}',
    jeans: '\u{1F456}',
    belt: '\u{1F397}\uFE0F',
    accessories: '\u231A',
    other: '\u{1F4E6}',
  }

  return (
    <Link href={`/clients/${clientId}/purchases/${purchase.id}/edit`}>
      <div className="flex items-center justify-between p-4 bg-gray-light rounded hover:bg-gray-med transition-colors cursor-pointer">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">{categoryIcons[purchase.category] || '\u{1F4E6}'}</span>
          <div className="min-w-0">
            <p className="font-body font-semibold truncate">
              {purchase.brand && `${purchase.brand} `}{purchase.product_name}
            </p>
            <p className="font-body text-sm text-gray-dark truncate">
              {[purchase.description, purchase.size && `Size: ${purchase.size}`].filter(Boolean).join(' \u00B7 ')}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          {purchase.price && (
            <p className="font-body font-semibold">${purchase.price.toLocaleString()}</p>
          )}
          {purchase.purchase_date && (
            <p className="font-body text-xs text-gray-dark mt-1">
              {new Date(purchase.purchase_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
