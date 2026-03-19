'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Users, Clock, TrendingUp, Calendar, Settings, Search } from 'lucide-react'

type LayoutProps = {
  children: React.ReactNode
  currentPage?: 'dashboard' | 'clients' | 'referrals' | 'orders' | 'calendar' | 'email' | 'settings'
  showSearch?: boolean
  showNewClient?: boolean
  showTrinity?: boolean
  /** Override the right-side action button */
  action?: React.ReactNode
  /** Page title shown in top bar */
  title?: string
}

export default function Layout({
  children,
  currentPage = 'dashboard',
  showNewClient = true,
  action,
  title,
}: LayoutProps) {
  const pathname = usePathname()

  return (
    <div className="h-[100dvh] flex flex-col bg-paper">

      {/* ===== TOP BAR — 52px ===== */}
      <header className="flex-shrink-0 h-[52px] flex items-center justify-between px-4 border-b border-rule bg-surface">
        {/* Left: brand mark + optional title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-charcoal flex items-center justify-center rounded-sm">
              <span className="font-serif text-paper text-[11px] font-bold tracking-wider">ES</span>
            </div>
          </Link>
          {title && (
            <h1 className="font-serif text-[17px] font-bold text-ink truncate">{title}</h1>
          )}
        </div>

        {/* Right: action button */}
        <div className="flex items-center gap-2">
          <Link href="/clients" aria-label="Search clients" className="w-11 h-11 flex items-center justify-center text-ink-muted">
            <Search className="w-5 h-5" />
          </Link>
          {action ? action : showNewClient && (
            <Link href="/clients/new" className="es-btn es-btn-primary es-btn-sm">
              <Plus className="w-4 h-4" />
              <span>New Client</span>
            </Link>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT — scrollable ===== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px' }}>
          {children}
        </div>
      </main>

      {/* ===== BOTTOM TAB BAR — iOS style ===== */}
      <nav className="es-tab-bar flex-shrink-0 bg-charcoal border-t border-charcoal-light" role="navigation" aria-label="Main navigation">
        <div className="flex items-stretch h-[56px]">
          <TabItem href="/" icon={<TrendingUp />} label="Dashboard" active={currentPage === 'dashboard' || pathname === '/'} />
          <TabItem href="/clients" icon={<Users />} label="Clients" active={currentPage === 'clients' || pathname?.startsWith('/clients')} />
          <TabItem href="/orders" icon={<Clock />} label="Orders" active={currentPage === 'orders' || pathname?.startsWith('/orders')} />
          <TabItem href="/calendar" icon={<Calendar />} label="Calendar" active={currentPage === 'calendar' || pathname?.startsWith('/calendar')} />
          <TabItem href="/settings" icon={<Settings />} label="More" active={currentPage === 'settings' || currentPage === 'email' || currentPage === 'referrals'} />
        </div>
      </nav>
    </div>
  )
}

function TabItem({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-gold' : 'text-paper/60'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="text-[10px] font-sans font-semibold tracking-wide">
        {label}
      </span>
    </Link>
  )
}
