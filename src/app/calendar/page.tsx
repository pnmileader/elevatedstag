'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, MapPin, User, Loader2, Calendar, Download } from 'lucide-react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface AppointmentRow {
  id: string
  title: string | null
  appointment_type: string | null
  start_time: string
  end_time: string
  location: string | null
  notes: string | null
  status: string | null
  client_id: string | null
  client?: { first_name: string | null; last_name: string | null; email: string | null } | null
}

function prettyType(type: string | null | undefined): string {
  if (!type) return 'Appointment'
  if (type.toLowerCase() === 'wardrobe') return 'Wardrobe Appointment'
  if (type.toLowerCase() === 'fitting') return 'Fitting'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
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
    async function fetchAppointments() {
      setLoading(true)
      setError(null)
      const { start, end } = getDateRange()

      try {
        const supabase = createClient()
        const { data, error: queryError } = await supabase
          .from('appointments')
          .select('id, title, appointment_type, start_time, end_time, location, notes, status, client_id, client:clients(first_name, last_name, email)')
          .gte('start_time', start.toISOString())
          .lte('start_time', end.toISOString())
          .order('start_time', { ascending: true })

        if (queryError) throw new Error(queryError.message)

        const rows: AppointmentRow[] = (data || []).map((row) => {
          const r = row as unknown as AppointmentRow & {
            client: AppointmentRow['client'] | Array<NonNullable<AppointmentRow['client']>>
          }
          return {
            ...r,
            client: Array.isArray(r.client) ? r.client[0] : r.client,
          }
        })
        setAppointments(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load appointments')
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
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

  function formatAppointmentTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function groupByDate(): Array<[string, AppointmentRow[]]> {
    const grouped: Record<string, AppointmentRow[]> = {}
    for (const apt of appointments) {
      const dateStr = new Date(apt.start_time).toDateString()
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(apt)
    }
    return Object.entries(grouped).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
  }

  return (
    <Layout currentPage="calendar">
      <div className="max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="font-heading text-lg font-medium text-body">Calendar</h1>
            <p className="font-body text-gray-dark">Manage appointments and fittings</p>
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
          ) : appointments.length === 0 ? (
            <div className="p-3 text-center">
              <Calendar className="w-12 h-12 text-gray-med mx-auto mb-4" />
              <p className="font-body text-gray-dark mb-4">No appointments scheduled for this period</p>
              <Link
                href="/calendar/new"
                className="text-gray-dark hover:text-body font-body text-sm font-medium"
              >
                Schedule an appointment →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-med">
              {groupByDate().map(([dateStr, dayAppointments]) => (
                <div key={dateStr}>
                  <div className="bg-gray-light px-4 py-2">
                    <h3 className="font-body font-medium text-sm text-gray-dark">
                      {new Date(dateStr).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-light">
                    {dayAppointments.map((apt) => {
                      const fullName = apt.client
                        ? `${apt.client.first_name ?? ''} ${apt.client.last_name ?? ''}`.trim()
                        : ''
                      const titleDisplay = apt.title || prettyType(apt.appointment_type)
                      return (
                        <div key={apt.id} className="p-5 flex items-start gap-2">
                          <div className="w-20 flex-shrink-0 text-right">
                            <span className="font-body text-sm font-medium text-body">
                              {formatAppointmentTime(apt.start_time)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-body font-medium text-body truncate">
                              {titleDisplay}
                            </h4>
                            {fullName && (
                              <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
                                <User className="w-3 h-3" />
                                {apt.client_id ? (
                                  <Link href={`/clients/${apt.client_id}`} className="hover:text-body underline-offset-2 hover:underline">
                                    {fullName}
                                  </Link>
                                ) : (
                                  fullName
                                )}
                              </p>
                            )}
                            {apt.location && (
                              <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {apt.location}
                              </p>
                            )}
                          </div>
                          <a
                            href={`/api/appointments/${apt.id}/ics`}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-body text-gray-dark hover:text-body border border-gray-med hover:border-body rounded transition-colors"
                            title="Download .ics file"
                          >
                            <Download className="w-3 h-3" />
                            .ics
                          </a>
                        </div>
                      )
                    })}
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
