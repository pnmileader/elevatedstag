'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { layoutDay, formatTimeRange, hourLabel, type DayBlock } from '@/lib/dayView'
import type { CalendarEntry } from '@/lib/calendarView'

const HOUR_PX = 56
/** Boxes shorter than this show title and time on one line. */
const ONE_LINE_PX = 44

/** One day as an hour grid, like Google Calendar's day view, in the CRM's colors. */
export default function DayCalendar({ day, entries }: { day: string; entries: CalendarEntry[] }) {
  const layout = useMemo(() => layoutDay(entries, day), [entries, day])
  const nowMin = useNowMinutes(day)
  const { startHour, endHour } = layout
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX

  return (
    <div data-testid="day-calendar">
      {layout.allDay.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-[20px] pb-2 pl-[64px]" data-testid="day-all-day">
          {layout.allDay.map((e) => (
            <span key={e.key} className="max-w-full truncate rounded px-2 py-1 text-[12px] font-medium bg-surface-alt text-ink border-l-[3px] border-gold">
              {e.title}
            </span>
          ))}
        </div>
      )}
      <div className="relative flex pr-[12px] mt-2" style={{ height: hours.length * HOUR_PX }}>
        <div className="w-[52px] flex-shrink-0 relative" aria-hidden>
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 text-[11px] text-ink-muted" style={{ top: i * HOUR_PX - 7 }}>
              {hourLabel(h)}
            </span>
          ))}
        </div>
        <div className="relative flex-1 border-l border-rule">
          {hours.map((h, i) => (
            <div key={h} className="absolute inset-x-0 border-t border-rule" style={{ top: i * HOUR_PX }} />
          ))}
          {layout.blocks.map((b) => (
            <Block key={b.entry.key} block={b} top={top(b.startMin)} height={((b.endMin - b.startMin) / 60) * HOUR_PX} />
          ))}
          {nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
            <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: top(nowMin) }} data-testid="day-now">
              <div className="absolute -left-[5px] -top-[4px] w-[9px] h-[9px] rounded-full bg-error" />
              <div className="border-t-2 border-error" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Block({ block, top, height }: { block: DayBlock; top: number; height: number }) {
  const { entry, col, cols } = block
  const isGoogle = entry.kind === 'google'
  const time = formatTimeRange(entry.start, entry.end)
  const oneLine = height < ONE_LINE_PX
  const subtitle = entry.clientName && !entry.title.includes(entry.clientName) ? entry.clientName : null
  // min-h-0/min-w-0: a box's height IS its duration, so it opts out of the app-wide 44px link floor.
  const className = `absolute min-h-0 min-w-0 overflow-hidden rounded px-2 text-[12px] leading-tight border border-surface ${
    isGoogle ? 'bg-surface-alt text-ink border-l-[3px] border-l-gold' : 'bg-charcoal text-white hover:bg-charcoal-light'
  } ${oneLine ? 'flex items-center gap-1.5 py-0' : 'py-1'}`
  const style = {
    top: top + 1,
    height: Math.max(height - 2, 18),
    left: `calc(${(col / cols) * 100}% + 2px)`,
    width: `calc(${100 / cols}% - 4px)`,
  }
  const body = oneLine ? (
    <>
      <span className="font-semibold truncate">{entry.title}</span>
      <span className={`flex-shrink-0 ${isGoogle ? 'text-ink-secondary' : 'text-white/75'}`}>{time}</span>
    </>
  ) : (
    <>
      <div className="font-semibold truncate">{entry.title}</div>
      <div className={isGoogle ? 'text-ink-secondary' : 'text-white/75'}>{time}</div>
      {subtitle && <div className="truncate mt-0.5">{subtitle}</div>}
      {entry.location && <div className={`truncate ${isGoogle ? 'text-ink-secondary' : 'text-white/75'}`}>{entry.location}</div>}
    </>
  )
  const testId = `day-block-${entry.kind}`
  return entry.clientId ? (
    <Link href={`/clients/${entry.clientId}`} className={className} style={style} data-testid={testId} title={`${entry.title}, ${time}`}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style} data-testid={testId} title={`${entry.title}, ${time}`}>
      {body}
    </div>
  )
}

/** Minutes after midnight right now if `day` is today (refreshed every minute), else null. */
function useNowMinutes(day: string): number | null {
  const read = () => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return today === day ? now.getHours() * 60 + now.getMinutes() : null
  }
  const [min, setMin] = useState<number | null>(null)
  useEffect(() => {
    setMin(read())
    const id = setInterval(() => setMin(read()), 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])
  return min
}
