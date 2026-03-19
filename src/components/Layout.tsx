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
    <div className="min-h-screen bg-gray-light">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-med px-4 lg:px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4 lg:gap-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 text-gray-dark hover:text-[#2D2D2D] transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-heading font-semibold text-sm">ES</span>
            </div>
            <span className="font-heading text-[#2D2D2D] text-base font-medium tracking-wide hidden sm:block whitespace-nowrap">
              THE ELEVATED STAG
            </span>
          </div>

          {/* Search */}
          {showSearch && <SearchBar />}

          {/* Right actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {showTrinity && (
              <a
                href="https://workflow.trinity-apparel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex border border-gray-med text-gray-dark hover:text-[#2D2D2D] hover:border-gold px-4 py-2 rounded-xl font-body text-sm items-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Trinity
              </a>
            )}
            {showNewClient && (
              <Link
                href="/clients/new"
                className="bg-[#2D2D2D] hover:bg-[#404040] text-white px-4 lg:px-5 py-2 rounded-xl font-body font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Client</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-56 bg-white border-r border-gray-med min-h-[calc(100vh-65px)] py-4 flex-shrink-0 flex flex-col space-y-1
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:w-14 lg:w-56
        `}>
          {/* Close button for mobile */}
          <div className="flex items-center justify-between px-4 pb-3 lg:hidden">
            <span className="font-heading text-sm font-medium text-[#2D2D2D]">Menu</span>
            <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-gray-dark hover:text-[#2D2D2D]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <NavItem href="/" icon={<TrendingUp />} label="Dashboard" active={currentPage === 'dashboard'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/clients" icon={<Users />} label="Clients" active={currentPage === 'clients'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/referrals" icon={<UserPlus />} label="Referrals" active={currentPage === 'referrals'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/orders" icon={<Clock />} label="Orders" active={currentPage === 'orders'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/calendar" icon={<Calendar />} label="Calendar" active={currentPage === 'calendar'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/email" icon={<Mail />} label="Email" active={currentPage === 'email'} onClick={() => setMobileMenuOpen(false)} />
          <NavItem href="/settings" icon={<Settings />} label="Settings" active={currentPage === 'settings'} onClick={() => setMobileMenuOpen(false)} />
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10">
          <div className="max-w-6xl">
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
  disabled = false,
  soon = false,
  onClick,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  soon?: boolean
  onClick?: () => void
}) {
  const baseClasses = "flex items-center gap-4 px-4 lg:px-6 py-3 font-body text-sm transition-colors"

  if (disabled) {
    return (
      <span className={`${baseClasses} text-gray-dark opacity-50 cursor-not-allowed`}>
        <span className="w-5 h-5 flex-shrink-0">{icon}</span>
        <span className="lg:inline">{label}</span>
        {soon && <span className="lg:inline text-xs">(Soon)</span>}
      </span>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${baseClasses} ${
        active
          ? 'bg-gray-light text-[#2D2D2D] font-medium border-l-2 border-gold'
          : 'text-gray-dark hover:bg-gray-light hover:text-[#2D2D2D]'
      }`}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span className="lg:inline">{label}</span>
    </Link>
  )
}
