import Link from 'next/link'
import { MapPin, User, Download, CheckSquare } from 'lucide-react'
import type { CalendarEntry } from '@/lib/calendarView'

/** One line on the calendar: a CRM appointment, a dated care item, or a (read-only) Google event. */
export default function CalendarEntryRow({ entry }: { entry: CalendarEntry }) {
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
              <Link href={`/clients/${entry.clientId}`} className="inline-flex items-center min-h-[44px] -my-3 hover:text-body underline-offset-2 hover:underline">
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
