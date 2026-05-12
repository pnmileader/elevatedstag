import { createEvent, type EventAttributes, type DateArray } from 'ics'

export type CalendarClient = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

export type CalendarAppointment = {
  id: string
  appointment_type: string | null
  title?: string | null
  start_time: string
  end_time: string
  location?: string | null
  notes?: string | null
}

export type GenerateIcsResult =
  | { success: true; value: string }
  | { success: false; error: string }

function toUtcDateArray(iso: string): DateArray {
  const d = new Date(iso)
  if (isNaN(d.getTime())) throw new Error(`invalid date: ${iso}`)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ]
}

function prettyAppointmentType(type: string | null | undefined): string {
  if (!type) return 'Appointment'
  switch (type.toLowerCase()) {
    case 'wardrobe':
    case 'wardrobe appointment':
      return 'Wardrobe Appointment'
    case 'fitting':
      return 'Fitting'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

export function generateAppointmentIcs(
  appointment: CalendarAppointment,
  client: CalendarClient,
): GenerateIcsResult {
  try {
    const clientFullName = `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client'
    const titleBase = appointment.title?.trim()
      || `${prettyAppointmentType(appointment.appointment_type)} - ${clientFullName}`

    const descriptionLines: string[] = [`Client: ${clientFullName}`]
    if (client.phone) descriptionLines.push(`Phone: ${client.phone}`)
    if (client.email) descriptionLines.push(`Email: ${client.email}`)
    if (appointment.notes && appointment.notes.trim()) {
      descriptionLines.push('')
      descriptionLines.push(`Notes: ${appointment.notes.trim()}`)
    }

    const start = toUtcDateArray(appointment.start_time)
    const end = toUtcDateArray(appointment.end_time)

    const event: EventAttributes = {
      uid: `appointment-${appointment.id}@theelevatedstag.com`,
      title: titleBase,
      start,
      startInputType: 'utc',
      startOutputType: 'utc',
      end,
      endInputType: 'utc',
      endOutputType: 'utc',
      description: descriptionLines.join('\n'),
      status: 'CONFIRMED',
      organizer: { name: 'Katie Fore', email: 'katie@theelevatedstag.com' },
      productId: 'TheElevatedStag/CRM',
      calName: 'The Elevated Stag',
    }

    if (appointment.location && appointment.location.trim()) {
      event.location = appointment.location.trim()
    }

    if (client.email) {
      event.attendees = [
        { name: clientFullName, email: client.email, rsvp: true, partstat: 'NEEDS-ACTION' },
      ]
    }

    const { error, value } = createEvent(event)
    if (error || !value) {
      const message = error instanceof Error ? error.message : (error ? String(error) : 'ics returned no value')
      return { success: false, error: message }
    }
    return { success: true, value }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
