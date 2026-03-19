'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Clock, TrendingUp, Calendar, Mail, ExternalLink, Settings, Menu, X, UserPlus } from 'lucide-react'
import SearchBar from '@/components/SearchBar'

type LayoutProps = {
  children: React.ReactNode
  currentPage?: 'dashboard' | 'clients' | 'referrals' | 'orders' | 'calendar' | 'email' | 'settings'
  showSearch?: boolean
  showNewClient?: boolean
  showTrinity?: boolean
}

export default function Layout({
  children,
  currentPage = 'dashboard',
  showSearch = true,
  showNewClient = true,
  showTrinity = false,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header — 48px, warm-white, bottom border */}
      <header className="bg-warm-white h-12 min-h-[48px] flex-shrink-0 border-b border-gray-med z-50 flex items-center px-4 lg:px-4 gap-4">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 -ml-2 text-gray-dark hover:text-body transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        {/* Logo — ES badge, 32px, sharp corners */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 bg-charcoal flex items-center justify-center flex-shrink-0">
            <span className="text-cream font-heading font-bold text-[11px] tracking-wide">ES</span>
          </div>
          <span className="font-heading text-body text-[15px] font-semibold tracking-wide hidden sm:block whitespace-nowrap">
            THE ELEVATED STAG
          </span>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-auto">
            <SearchBar />
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {showTrinity && (
            <a
              href="https://workflow.trinity-apparel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn ds-btn-secondary hidden sm:inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Trinity
            </a>
          )}
          {showNewClient && (
            <Link href="/clients/new" className="ds-btn ds-btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Client</span>
            </Link>
          )}
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-charcoal/60 z-40 lg:hidden"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar — collapsed 48px on desktop, expands on hover via group */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          className={`
            group/sidebar
            fixed lg:static inset-y-0 left-0 z-40
            bg-charcoal flex-shrink-0 flex flex-col overflow-hidden
            transition-all duration-200 ease-in-out
            ${mobileMenuOpen
              ? 'w-[200px] translate-x-0'
              : '-translate-x-full lg:translate-x-0 w-[200px] lg:w-12 lg:hover:w-[200px]'
            }
          `}
        >
          {/* Mobile close button */}
          <div className="flex items-center justify-between px-3 h-12 min-h-[48px] lg:hidden">
            <span className="font-body text-[12px] font-medium text-cream/70">Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-cream/50 hover:text-cream"
              aria-label="Close menu"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Nav items */}
          <div className="flex flex-col gap-0.5 pt-3 lg:pt-4">
            <NavItem href="/" icon={<TrendingUp />} label="Dashboard" active={currentPage === 'dashboard'} onClick={() => setMobileMenuOpen(false)} />
            <NavItem href="/clients" icon={<Users />} label="Clients" active={currentPage === 'clients'} onClick={() => setMobileMenuOpen(false)} />
            <NavItem href="/referrals" icon={<UserPlus />} label="Referrals" active={currentPage === 'referrals'} onClick={() => setMobileMenuOpen(false)} />
            <NavItem href="/orders" icon={<Clock />} label="Orders" active={currentPage === 'orders'} onClick={() => setMobileMenuOpen(false)} />
            <NavItem href="/calendar" icon={<Calendar />} label="Calendar" active={currentPage === 'calendar'} onClick={() => setMobileMenuOpen(false)} />
            <NavItem href="/email" icon={<Mail />} label="Email" active={currentPage === 'email'} onClick={() => setMobileMenuOpen(false)} />
          </div>

          {/* Settings at bottom */}
          <div className="mt-auto pb-3 border-t border-charcoal-mid">
            <NavItem href="/settings" icon={<Settings />} label="Settings" active={currentPage === 'settings'} onClick={() => setMobileMenuOpen(false)} />
          </div>
        </nav>

        {/* Main content — independent scroll */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="max-w-[1100px] p-3 sm:p-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
  active = false,
  onClick,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        relative flex items-center h-[36px] font-body text-[13px] transition-colors
        ${active
          ? 'text-cream border-l-2 border-gold'
          : 'text-cream/50 hover:text-cream/80 border-l-2 border-transparent'
        }
      `}
    >
      {/* Icon — always centered in 48px */}
      <span className="w-12 min-w-[48px] flex items-center justify-center flex-shrink-0">
        <span className="w-[18px] h-[18px]">{icon}</span>
      </span>
      {/* Label — visible on hover (desktop) or when mobile menu open */}
      <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 max-lg:!opacity-100">
        {label}
      </span>
    </Link>
  )
}
