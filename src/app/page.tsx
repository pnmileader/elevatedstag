'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase'
import { formatDateOnly, monthsAgoISO, parseDateOnly } from '@/lib/dates'
import { THANK_YOU_TYPE } from '@/lib/careItems'
import { buildCalendarDays, type AppointmentInput, type CalendarEntry } from '@/lib/calendarView'
import type { ExternalEvent } from '@/lib/googleIcal'
import CalendarEntryRow from '@/components/CalendarEntryRow'
import DashboardCareItems, { type DashboardCareItem } from '@/components/DashboardCareItems'
import type { ComboClient } from '@/components/ClientCombobox'

// Katie's dashboard (Oct 2026): what she acts on in the field — care items, the week ahead,
// and a call list. Revenue and client counts live in QuickBooks, which has the full picture.

type Person = { first_name: string | null; last_name: string | null } | null
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

interface OverdueClient {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  last_purchase_date: string
}

type GoogleStatus = 'off' | 'on' | 'error'

interface DashboardData {
  careItems: DashboardCareItem[]
  clients: ComboClient[]
  week: Array<{ day: string; entries: CalendarEntry[] }>
  googleStatus: GoogleStatus
  overdue: OverdueClient[]
}

const OVERDUE_MONTHS = 6
const OVERDUE_PREVIEW = 25

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const now = new Date()
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000 - 1)

      const google = fetch(`/api/calendar/google?start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(weekEnd.toISOString())}`)
        .then(async (res) => {
          const body = (await res.json()) as { configured?: boolean; events?: ExternalEvent[]; error?: string }
          return { status: (!body.configured ? 'off' : body.error ? 'error' : 'on') as GoogleStatus, events: body.events ?? [] }
        })
        .catch(() => ({ status: 'error' as GoogleStatus, events: [] as ExternalEvent[] }))

      const [careRes, clientsRes, aptRes, overdueRes, googleRes] = await Promise.all([
        supabase
          .from('client_care_items')
          .select('id, item_type, title, completed, completed_at, due_date, created_at, client_id, client:clients(id, first_name, last_name)')
          .eq('completed', false)
          .neq('item_type', THANK_YOU_TYPE),
        supabase.from('clients').select('id, first_name, last_name, email').order('last_name').range(0, 4999),
        supabase
          .from('appointments')
          .select('id, title, appointment_type, start_time, location, client_id, client:clients(first_name, last_name)')
          .gte('start_time', weekStart.toISOString())
          .lte('start_time', weekEnd.toISOString())
          .order('start_time', { ascending: true }),
        supabase
          .from('clients')
          .select('id, first_name, last_name, phone, last_purchase_date')
          .not('last_purchase_date', 'is', null)
          .lte('last_purchase_date', monthsAgoISO(OVERDUE_MONTHS, now))
          .order('last_purchase_date', { ascending: false })
          .range(0, 4999),
        google,
      ])
      if (cancelled) return

      const appointments = (aptRes.data || []).map((r) => ({ ...r, client: one(r.client as Person | Person[]) })) as AppointmentInput[]
      setData({
        careItems: (careRes.data || []).map((r) => ({ ...r, client: one(r.client) })) as unknown as DashboardCareItem[],
        clients: (clientsRes.data || []) as ComboClient[],
        week: buildCalendarDays(appointments, [], googleRes.events),
        googleStatus: googleRes.status,
        overdue: (overdueRes.data || []) as OverdueClient[],
      })
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!data) {
    return (
      <Layout currentPage="dashboard" title="Dashboard">
        <DashboardSkeleton />
      </Layout>
    )
  }

  return (
    <Layout currentPage="dashboard" title="Dashboard">
      <div className="flex flex-col gap-6 t-skel-content" data-testid="dashboard-content">
        <DashboardCareItems initialItems={data.careItems} clients={data.clients} />
        <ThisWeek days={data.week} googleStatus={data.googleStatus} />
        <OverdueForAppointment clients={data.overdue} />
      </div>
    </Layout>
  )
}

function ThisWeek({ days, googleStatus }: { days: Array<{ day: string; entries: CalendarEntry[] }>; googleStatus: GoogleStatus }) {
  return (
    <section data-testid="dash-week">
      <div className="es-section-header justify-between">
        <span>This Week</span>
        <Link href="/calendar" className="min-h-[44px] -my-3 inline-flex items-center normal-case tracking-normal font-body text-sm font-medium text-gray-dark hover:text-body">
          Calendar
        </Link>
      </div>
      {googleStatus !== 'on' && (
        <p className="font-body text-xs text-ink-muted px-[20px] pt-1 pb-2" data-testid="dash-week-google-note">
          {googleStatus === 'off'
            ? 'Showing CRM appointments. Your Google Calendar will appear here once it’s connected.'
            : 'Couldn’t load your Google Calendar right now. Showing CRM appointments.'}
        </p>
      )}
      {days.length === 0 ? (
        <p className="font-body text-sm text-gray-dark px-[20px] py-3">Nothing scheduled in the next 7 days.</p>
      ) : (
        days.map(({ day, entries }) => (
          <div key={day}>
            <div className="bg-gray-light px-[20px] py-1.5 font-body text-xs font-medium text-gray-dark">
              {parseDateOnly(day)!.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            {entries.map((entry) => (
              <CalendarEntryRow key={entry.key} entry={entry} />
            ))}
          </div>
        ))
      )}
    </section>
  )
}

function OverdueForAppointment({ clients }: { clients: OverdueClient[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? clients : clients.slice(0, OVERDUE_PREVIEW)
  return (
    <section data-testid="dash-overdue">
      <div className="es-section-header">
        Overdue for an Appointment <span className="ml-1.5 normal-case tracking-normal text-ink-muted">{clients.length}</span>
      </div>
      <p className="font-body text-xs text-ink-muted px-[20px] pt-1 pb-2">No purchase in {OVERDUE_MONTHS}+ months. Most recent first.</p>
      {clients.length === 0 ? (
        <p className="font-body text-sm text-gray-dark px-[20px] py-3">Everyone has purchased in the last {OVERDUE_MONTHS} months.</p>
      ) : (
        <>
          {visible.map((c) => (
            <div key={c.id} className="es-row" data-testid="dash-overdue-row">
              <Link href={`/clients/${c.id}`} className="min-w-0 flex-1 min-h-[44px] flex flex-col justify-center">
                <div className="font-semibold truncate">{`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed client'}</div>
                <div className="text-ink-muted text-[12px]">
                  Last purchase {formatDateOnly(c.last_purchase_date, { month: 'short', year: 'numeric' })}
                </div>
              </Link>
              {c.phone ? (
                <a
                  href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                  className="flex-shrink-0 min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded border border-gray-med text-sm font-medium text-body hover:border-body"
                  data-testid="dash-overdue-phone"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {c.phone}
                </a>
              ) : (
                <span className="flex-shrink-0 text-[12px] text-ink-muted">No phone</span>
              )}
            </div>
          ))}
          {clients.length > OVERDUE_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full min-h-[44px] font-body text-sm font-medium text-gray-dark hover:text-body"
              data-testid="dash-overdue-toggle"
            >
              {showAll ? 'Show fewer' : `Show all ${clients.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Holds the dashboard's shape while data loads; the real content fades + un-blurs in over it. */
function DashboardSkeleton() {
  const bar = (w: number | string, h: number) => <div className="es-skeleton" style={{ width: w, height: h }} />
  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      {['Care Items Due', 'This Week', 'Overdue for an Appointment'].map((title) => (
        <section key={title}>
          <div className="es-section-header">{title}</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="es-row">
              <div className="flex-1 flex flex-col gap-2">{bar('45%', 12)}{bar('30%', 10)}</div>
              {bar(56, 12)}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
