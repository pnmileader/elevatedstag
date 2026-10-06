// Merges the three things the CRM calendar shows into one day-by-day list:
// CRM appointments, dated Client Care items, and (read-only) Google Calendar events.
import { localISODate } from './dashboard'
import { careLabel } from './careItems'
import type { ExternalEvent } from './googleIcal'

export type CalendarEntry = {
  key: string
  kind: 'appointment' | 'care' | 'google'
  day: string // YYYY-MM-DD, local
  allDay: boolean
  start: string // ISO for timed entries, YYYY-MM-DD for all-day
  title: string
  clientId: string | null
  clientName: string
  location: string | null
  appointmentId?: string
}

type Person = { first_name: string | null; last_name: string | null } | null | undefined

export type AppointmentInput = {
  id: string
  title: string | null
  appointment_type: string | null
  start_time: string
  location: string | null
  client_id: string | null
  client?: Person
}

export type CareInput = {
  id: string
  title: string
  item_type: string | null
  due_date: string
  client_id: string | null
  client?: Person
}

function fullName(p: Person): string {
  return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : ''
}

export function prettyAppointmentType(type: string | null | undefined): string {
  if (!type) return 'Appointment'
  if (type.toLowerCase() === 'wardrobe') return 'Wardrobe Appointment'
  if (type.toLowerCase() === 'fitting') return 'Fitting'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function buildCalendarDays(
  appointments: AppointmentInput[],
  careItems: CareInput[],
  googleEvents: ExternalEvent[],
): Array<{ day: string; entries: CalendarEntry[] }> {
  const entries: CalendarEntry[] = [
    ...appointments.map((a): CalendarEntry => ({
      key: `apt-${a.id}`,
      kind: 'appointment',
      day: localISODate(new Date(a.start_time)),
      allDay: false,
      start: a.start_time,
      title: a.title || prettyAppointmentType(a.appointment_type),
      clientId: a.client_id,
      clientName: fullName(a.client),
      location: a.location,
      appointmentId: a.id,
    })),
    ...careItems.map((c): CalendarEntry => ({
      key: `care-${c.id}`,
      kind: 'care',
      day: c.due_date.slice(0, 10),
      allDay: true,
      start: c.due_date.slice(0, 10),
      title: `${careLabel(c.item_type)}: ${c.title}`,
      clientId: c.client_id,
      clientName: fullName(c.client),
      location: null,
    })),
    ...googleEvents.map((g): CalendarEntry => ({
      key: `g-${g.id}`,
      kind: 'google',
      day: g.allDay ? g.start : localISODate(new Date(g.start)),
      allDay: g.allDay,
      start: g.start,
      title: g.title,
      clientId: null,
      clientName: '',
      location: g.location,
    })),
  ]

  const byDay = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    const list = byDay.get(e.day) ?? []
    list.push(e)
    byDay.set(e.day, list)
  }
  // Within a day: all-day items first (care before Google), then timed entries by start time.
  const rank = (e: CalendarEntry) => (e.allDay ? (e.kind === 'care' ? 0 : 1) : 2)
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      entries: list.sort((a, b) => rank(a) - rank(b) || (a.allDay ? 0 : new Date(a.start).getTime() - new Date(b.start).getTime())),
    }))
}
