'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, MapPin, User, Loader2, Calendar } from 'lucide-react'
import Layout from '@/components/Layout'
import Link from 'next/link'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')

  // Get start and end of current week/month
  function getDateRange() {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (view === 'week') {
      const day = start.getDay()
      start.setDate(start.getDate() - day) // Start of week (Sunday)
      end.setDate(start.getDate() + 6) // End of week (Saturday)
    } else {
      start.setDate(1) // Start of month
      end.setMonth(end.getMonth() + 1)
      end.setDate(0) // End of month
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      setError(null)

      const { start, end } = getDateRange()

      try {
        const response = await fetch(
          `/api/calendar/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch events')
        }

        const data = await response.json()
        setEvents(data.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calendar')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, view])

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

  function formatEventTime(event: CalendarEvent) {
    const startDate = event.start.dateTime ? new Date(event.start.dateTime) : null
    if (!startDate) return 'All day'

    return startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Group events by date
  function groupEventsByDate() {
    const grouped: Record<string, CalendarEvent[]> = {}

    events.forEach(event => {
      const dateStr = event.start.dateTime
        ? new Date(event.start.dateTime).toDateString()
        : event.start.date
          ? new Date(event.start.date).toDateString()
          : 'Unknown'

      if (!grouped[dateStr]) {
        grouped[dateStr] = []
      }
      grouped[dateStr].push(event)
    })

    // Sort by date
    const sorted = Object.entries(grouped).sort(([a], [b]) =>
      new Date(a).getTime() - new Date(b).getTime()
    )

    return sorted
  }

  // Parse client name from event description
  function parseClientFromDescription(description?: string): string | null {
    if (!description) return null
    const match = description.match(/Client:\s*(.+?)(?:\n|$)/i)
    return match ? match[1].trim() : null
  }

  return (
    <Layout currentPage="calendar">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#2D2D2D]">Calendar</h1>
            <p className="font-body text-gray-dark">Manage appointments and fittings</p>
          </div>

          <Link
            href="/calendar/new"
            className="bg-[#2D2D2D] hover:bg-[#404040] text-white px-4 py-2 rounded-xl font-body font-medium text-sm inline-flex items-center gap-2 transition-colors w-fit"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Link>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl p-5 border border-gray-med mb-6" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={navigatePrev}
                className="p-2 hover:bg-gray-light rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={navigateNext}
                className="p-2 hover:bg-gray-light rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-body font-medium text-[#8A8A8A] hover:text-[#2D2D2D] hover:bg-gray-light rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            <h2 className="font-heading text-base font-medium text-[#2D2D2D]">{formatDateRange()}</h2>

            <div className="flex items-center gap-1 bg-gray-light rounded-xl p-1">
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 text-sm font-body font-medium rounded-xl transition-colors ${
                  view === 'week' ? 'bg-white shadow-sm text-[#2D2D2D]' : 'text-gray-dark hover:text-[#2D2D2D]'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 text-sm font-body font-medium rounded-xl transition-colors ${
                  view === 'month' ? 'bg-white shadow-sm text-[#2D2D2D]' : 'text-gray-dark hover:text-[#2D2D2D]'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-2xl border border-gray-med overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#8A8A8A]" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500 font-body mb-4">{error}</p>
              <Link
                href="/settings"
                className="text-[#8A8A8A] hover:text-[#2D2D2D] font-body text-sm font-medium"
              >
                Connect Google Calendar →
              </Link>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-med mx-auto mb-4" />
              <p className="font-body text-gray-dark mb-4">No appointments scheduled for this period</p>
              <Link
                href="/calendar/new"
                className="text-[#8A8A8A] hover:text-[#2D2D2D] font-body text-sm font-medium"
              >
                Schedule an appointment →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-med">
              {groupEventsByDate().map(([dateStr, dayEvents]) => (
                <div key={dateStr}>
                  <div className="bg-gray-light px-4 py-2">
                    <h3 className="font-body font-medium text-sm text-gray-dark">
                      {new Date(dateStr).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-light">
                    {dayEvents.map(event => {
                      const clientName = parseClientFromDescription(event.description)

                      return (
                        <Link
                          key={event.id}
                          href={`/calendar/${event.id}`}
                          className="block p-5 hover:bg-gray-light/50 transition-colors"
                        >
                          <div className="flex items-start gap-5">
                            <div className="w-20 flex-shrink-0 text-right">
                              <span className="font-body text-sm font-medium text-[#2D2D2D]">
                                {formatEventTime(event)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-body font-medium text-[#2D2D2D] truncate">
                                {event.summary}
                              </h4>
                              {clientName && (
                                <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
                                  <User className="w-3 h-3" />
                                  {clientName}
                                </p>
                              )}
                              {event.location && (
                                <p className="font-body text-sm text-gray-dark flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
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
