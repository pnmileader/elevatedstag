'use client'

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Users, Clock, TrendingUp, Calendar, Settings, Search, LogOut, Mail, UserPlus, X } from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import PageTransition from '@/components/motion/PageTransition'
import { useOpenClose } from '@/components/motion/useOpenClose'

type LayoutProps = {
  children: React.ReactNode
  currentPage?: 'dashboard' | 'clients' | 'referrals' | 'orders' | 'calendar' | 'email' | 'settings'
  showSearch?: boolean
  showNewClient?: boolean
  showTrinity?: boolean
  action?: React.ReactNode
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const menu = useOpenClose(menuOpen, 150)

  // iOS Safari only raises the keyboard when focus() runs inside the tap
  // handler itself, so render the field synchronously, then focus it.
  const openSearch = () => {
    setMenuOpen(false)
    flushSync(() => setSearchOpen(true))
    searchInputRef.current?.focus()
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-paper">

      {/* ===== TOP BAR ===== */}
      <header className="relative z-30 flex-shrink-0 h-[52px] flex items-center justify-between px-4 border-b border-rule bg-surface">
        {searchOpen ? (
          <div className="flex items-center gap-1 w-full">
            <SearchBar inputRef={searchInputRef} onClose={() => setSearchOpen(false)} />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="w-[44px] h-[44px] flex items-center justify-center text-ink-muted flex-shrink-0"
              aria-label="Close search"
              data-testid="search-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {/* Left: brand + title */}
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="w-[44px] h-[44px] -ml-1.5 flex items-center justify-center flex-shrink-0" aria-label="Dashboard home">
                <div className="w-8 h-8 bg-charcoal flex items-center justify-center rounded-sm">
                  <span className="font-serif text-paper text-[11px] font-bold tracking-wider">ES</span>
                </div>
              </Link>
              {title && (
                <h1 className="font-serif text-[17px] font-bold text-ink truncate">{title}</h1>
              )}
            </div>

            {/* Right: settings gear, search, action */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-[44px] h-[44px] flex items-center justify-center text-ink-muted"
                aria-label="Settings menu"
                aria-expanded={menuOpen}
                data-testid="gear-icon"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search clients, orders, fabrics"
                className="w-[44px] h-[44px] flex items-center justify-center text-ink-muted"
                data-testid="search-icon"
              >
                <Search className="w-5 h-5" />
              </button>
              {action ? action : showNewClient && (
                <Link href="/clients/new" className="es-btn es-btn-primary es-btn-sm">
                  <Plus className="w-4 h-4" />
                  <span>New Client</span>
                </Link>
              )}
            </div>
          </>
        )}
      </header>

      {/* ===== SETTINGS/MORE DROPDOWN ===== */}
      {menu.mounted && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className={`t-dropdown ${menu.stateClass} absolute right-4 top-[52px] z-50 bg-surface border border-rule rounded`}
            data-origin="top-right"
            data-testid="settings-menu"
            style={{ minWidth: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}
          >
            <Link
              href="/referrals"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 min-h-[48px] text-ink hover:bg-paper border-b border-rule"
            >
              <UserPlus className="w-4 h-4 text-ink-muted" />
              <span className="font-sans text-[14px]">Referrals</span>
            </Link>
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 min-h-[48px] text-ink hover:bg-paper border-b border-rule"
            >
              <Settings className="w-4 h-4 text-ink-muted" />
              <span className="font-sans text-[14px]">Settings</span>
            </Link>
            <button
              onClick={async () => {
                setMenuOpen(false)
                const { createClient } = await import('@/lib/supabase')
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="flex items-center gap-3 px-4 min-h-[48px] text-ink hover:bg-paper w-full text-left"
            >
              <LogOut className="w-4 h-4 text-ink-muted" />
              <span className="font-sans text-[14px]">Sign Out</span>
            </button>
          </div>
        </>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px' }}>
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* ===== BOTTOM TAB BAR ===== */}
      <nav className="es-tab-bar flex-shrink-0 bg-charcoal border-t border-charcoal-light" role="navigation" aria-label="Main navigation">
        <div className="flex items-stretch h-[56px]">
          <TabItem href="/" icon={<TrendingUp />} label="Dashboard" active={currentPage === 'dashboard' || pathname === '/'} />
          <TabItem href="/clients" icon={<Users />} label="Clients" active={currentPage === 'clients' || pathname?.startsWith('/clients')} />
          <TabItem href="/orders" icon={<Clock />} label="Orders" active={currentPage === 'orders' || pathname?.startsWith('/orders')} />
          <TabItem href="/calendar" icon={<Calendar />} label="Calendar" active={currentPage === 'calendar' || pathname?.startsWith('/calendar')} />
          <TabItem href="/email" icon={<Mail />} label="Email" active={currentPage === 'email' || pathname?.startsWith('/email')} />
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
