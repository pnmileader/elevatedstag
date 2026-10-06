'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, MapPin, User, Loader2, Calendar, Download, CheckSquare } from 'lucide-react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { localISODate } from '@/lib/dashboard'
import { parseDateOnly } from '@/lib/dates'
import { buildCalendarDays, type AppointmentInput, type CalendarEntry, type CareInput } from '@/lib/calendarView'
import type { ExternalEvent } from '@/lib/googleIcal'

type Person = { first_name: string | null; last_name: string | null } | null
/** Supabase types an embedded relation as object-or-array; normalise to one row. */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

type GoogleStatus = 'loading' | 'off' | 'on' | 'error'

export default function CalendarPage() {
  const [days, setDays] = useState<Array<{ day: string; entries: CalendarEntry[] }>>([])
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('loading')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')

  const getDateRange = useCallback(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (view === 'week') {
      const day = start.getDay()
      start.setDate(start.getDate() - day)
      end.setDate(start.getDate() + 6)
    } else {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }, [currentDate, view])

  useEffect(() => {
    let cancelled = false
    async function fetchEntries() {
      setLoading(true)
      setError(null)
      const { start, end } = getDateRange()
      const supabase = createClient()

      const google = fetch(`/api/calendar/google?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`)
        .then(async (res) => {
          const body = (await res.json()) as { configured?: boolean; events?: ExternalEvent[]; error?: string }
          return { status: (!body.configured ? 'off' : body.error ? 'error' : 'on') as GoogleStatus, events: body.events ?? [] }
        })
        .catch(() => ({ status: 'error' as GoogleStatus, events: [] as ExternalEvent[] }))

      try {
        const [aptRes, careRes, googleRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, title, appointment_type, start_time, location, client_id, client:clients(first_name, last_name)')
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true }),
          supabase
            .from('client_care_items')
            .select('id, title, item_type, due_date, client_id, client:clients(first_name, last_name)')
            .eq('completed', false)
            .gte('due_date', localISODate(start))
            .lte('due_date', localISODate(end)),
          google,
        ])
        if (aptRes.error) throw new Error(aptRes.error.message)
        if (careRes.error) throw new Error(careRes.error.message)

        const appointments = (aptRes.data || []).map((r) => ({ ...r, client: one(r.client as Person | Person[]) })) as AppointmentInput[]
        const care = (careRes.data || []).map((r) => ({ ...r, client: one(r.client as Person | Person[]) })) as CareInput[]
        if (!cancelled) {
          setDays(buildCalendarDays(appointments, care, googleRes.events))
          setGoogleStatus(googleRes.status)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the calendar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEntries()
    return () => {
      cancelled = true
    }
  }, [getDateRange])

  function navigatePrev() {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  function navigateNext() {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  function formatDateRange() {
    const { start, end } = getDateRange()
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

    if (view === 'week') {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  return (
    <Layout currentPage="calendar">
      <div className="max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Calendar</h1>
            <p className="font-body text-gray-dark">
              Appointments, client care due dates
              {googleStatus === 'on' ? ', and your Google Calendar' : ''}
            </p>
            {googleStatus === 'error' && (
              <p className="font-body text-xs text-error mt-1" role="status">Couldn&rsquo;t load your Google Calendar right now.</p>
            )}
          </div>

          <Link
            href="/calendar/new"
            className="bg-body hover:bg-body-hover text-white px-4 py-2 rounded font-body font-medium text-sm inline-flex items-center gap-2 transition-colors w-fit"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Link>
        </div>

        <div className="bg-white rounded p-5 border border-gray-med mb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={navigatePrev}
                className="p-2 hover:bg-gray-light rounded transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={navigateNext}
                className="p-2 hover:bg-gray-light rounded transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-body font-medium text-gray-dark hover:text-body hover:bg-gray-light rounded transition-colors"
              >
                Today
              </button>
            </div>

            <h2 className="font-heading text-base font-medium text-body">{formatDateRange()}</h2>

            <div className="flex items-center gap-1 bg-gray-light rounded p-1">
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 text-sm font-body font-medium rounded transition-colors ${
                  view === 'week' ? 'bg-white text-body' : 'text-gray-dark hover:text-body'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 text-sm font-body font-medium rounded transition-colors ${
                  view === 'month' ? 'bg-white text-body' : 'text-gray-dark hover:text-body'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded border border-gray-med overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-8 h-8 animate-spin text-gray-dark" />
            </div>
          ) : error ? (
            <div className="p-3 text-center">
              <p className="text-red-500 font-body mb-2">{error}</p>
            </div>
          ) : days.length === 0 ? (
            <div className="px-5 py-8 text-center" data-testid="calendar-empty">
              <Calendar className="w-12 h-12 text-gray-med mx-auto mb-4" />
              <p className="font-body text-body font-medium mb-1">Nothing scheduled for this period</p>
              <p className="font-body text-sm text-gray-dark mb-4 max-w-md mx-auto">
                This calendar shows appointments you schedule in the CRM and Client Care items with a due date
                {googleStatus === 'on' ? ', plus the events on your Google Calendar' : ''}. Each appointment you
                schedule here is also sent to your own calendar as an invite, and the client gets one too.
              </p>
              <Link href="/calendar/new" className="es-btn es-btn-primary">
                Schedule an appointment
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-med">
              {days.map(({ day, entries }) => (
                <div key={day}>
                  <div className="bg-gray-light px-4 py-2">
                    <h3 className="font-body font-medium text-sm text-gray-dark">
                      {parseDateOnly(day)!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-light">
                    {entries.map((entry) => (
                      <CalendarEntryRow key={entry.key} entry={entry} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function CalendarEntryRow({ entry }: { entry: CalendarEntry }) {
  const isGoogle = entry.kind === 'google'
  const time = entry.allDay
    ? entry.kind === 'care' ? 'Due' : 'All day'
    : new Date(entry.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div className={`p-5 flex items-start gap-2 ${isGoogle ? 'bg-surface-alt/40' : ''}`} data-testid={`cal-entry-${entry.kind}`}>
      <div className="w-20 flex-shrink-0 text-right">
        <span className={`font-body text-sm font-medium ${isGoogle ? 'text-gray-dark' : 'text-body'}`}>{time}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-body font-medium truncate flex items-center gap-1.5 ${isGoogle ? 'text-gray-dark' : 'text-body'}`}>
          {entry.kind === 'care' && <CheckSquare className="w-4 h-4 flex-shrink-0 text-gold" aria-hidden />}
          <span className="truncate">{entry.title}</span>
          {isGoogle && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded border border-gray-med text-[10px] uppercase tracking-wide text-gray-dark">Google</span>
          )}
        </h4>
        {entry.clientName && (
          <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
            <User className="w-3 h-3" />
            {entry.clientId ? (
              <Link href={`/clients/${entry.clientId}`} className="hover:text-body underline-offset-2 hover:underline">
                {entry.clientName}
              </Link>
            ) : (
              entry.clientName
            )}
          </p>
        )}
        {entry.location && (
          <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {entry.location}
          </p>
        )}
      </div>
      {entry.appointmentId && (
        <a
          href={`/api/appointments/${entry.appointmentId}/ics`}
          className="flex items-center gap-1 min-h-[44px] px-2 text-xs font-body text-gray-dark hover:text-body border border-gray-med hover:border-body rounded transition-colors"
          title="Download .ics file"
        >
          <Download className="w-3 h-3" />
          .ics
        </a>
      )}
    </div>
  )
}
