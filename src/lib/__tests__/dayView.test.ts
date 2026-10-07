// Run with: TZ=America/Chicago npx tsx src/lib/__tests__/dayView.test.ts
import assert from 'node:assert/strict'
import { layoutDay, formatTimeRange, DEFAULT_START_HOUR, DEFAULT_END_HOUR } from '../dayView'
import type { CalendarEntry } from '../calendarView'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }

const at = (h: number, m = 0, day = 7) => new Date(2026, 9, day, h, m).toISOString()
let n = 0
const timed = (title: string, start: string, end: string | null): CalendarEntry =>
  ({ key: `k${n++}`, kind: 'google', day: start.slice(0, 10), allDay: false, start, end, title, clientId: null, clientName: '', location: null })
const allDay = (title: string, start: string, end: string): CalendarEntry =>
  ({ key: `k${n++}`, kind: 'google', day: start, allDay: true, start, end, title, clientId: null, clientName: '', location: null })

const DAY = '2026-10-07'
const byTitle = (blocks: ReturnType<typeof layoutDay>['blocks']) => Object.fromEntries(blocks.map((b) => [b.entry.title, b]))

t('Katie’s Oct 7: boxes sit at their times, overlaps share the row side by side', () => {
  const layout = layoutDay([
    timed('Drive Time', at(9), at(11)),
    timed('Matthew Pearson: Socks/Drop off suits', at(11), at(11, 30)),
    timed('Tom Contreras: Fitting Appt', at(13), at(14)),
    timed('Sandra Coming 2p-4p', at(14), at(16, 45)),
    timed('Drive Time 2', at(14), at(14, 30)),
    timed('Tim Crank: Fitting Appt', at(14, 30), at(15, 30)),
    timed('Drive Time 3', at(18), at(19)),
  ], DAY)
  const b = byTitle(layout.blocks)
  assert.deepEqual([b['Drive Time'].startMin, b['Drive Time'].endMin], [540, 660])
  assert.equal(b['Drive Time'].cols, 1, 'nothing overlaps the morning drive')
  assert.equal(b['Matthew Pearson: Socks/Drop off suits'].cols, 1, 'back-to-back is not an overlap')
  assert.equal(b['Sandra Coming 2p-4p'].cols, 2)
  assert.equal(b['Sandra Coming 2p-4p'].col, 0, 'the longer event takes the left column')
  assert.deepEqual([b['Drive Time 2'].col, b['Tim Crank: Fitting Appt'].col], [1, 1], 'later events reuse a freed column')
  assert.equal(b['Tim Crank: Fitting Appt'].cols, 2)
  assert.equal(layout.startHour, DEFAULT_START_HOUR)
  assert.equal(layout.endHour, 19, 'grid stretches to the last event')
})

t('three-way overlap splits into three columns', () => {
  const { blocks } = layoutDay([timed('A', at(10), at(12)), timed('B', at(10, 30), at(11)), timed('C', at(10, 45), at(11, 30))], DAY)
  assert.deepEqual(blocks.map((b) => [b.entry.title, b.col, b.cols]), [['A', 0, 3], ['B', 1, 3], ['C', 2, 3]])
})

t('all-day items go on top, including multi-day ones that started earlier; other days are left out', () => {
  const layout = layoutDay([
    allDay('Trunk show', '2026-10-05', '2026-10-09'),
    allDay('Today only', DAY, '2026-10-08'),
    allDay('Tomorrow', '2026-10-08', '2026-10-09'),
    allDay('Yesterday', '2026-10-06', '2026-10-07'),
    timed('Tomorrow fitting', at(10, 0, 8), at(11, 0, 8)),
  ], DAY)
  assert.deepEqual(layout.allDay.map((e) => e.title), ['Trunk show', 'Today only'])
  assert.equal(layout.blocks.length, 0)
})

t('no end time means one hour; tiny events still get a readable box; early and late events widen the grid', () => {
  const layout = layoutDay([timed('No end', at(6, 30), null), timed('Blip', at(12), at(12)), timed('Late', at(21), at(22, 15))], DAY)
  const b = byTitle(layout.blocks)
  assert.deepEqual([b['No end'].startMin, b['No end'].endMin], [390, 450])
  assert.ok(b['Blip'].endMin - b['Blip'].startMin >= 20)
  assert.equal(layout.startHour, 6)
  assert.equal(layout.endHour, 23)
})

t('an event crossing midnight is clipped to today', () => {
  const { blocks } = layoutDay([timed('Red-eye', at(23), at(2, 0, 8)), timed('Late night', at(22, 0, 6), at(1, 0))], DAY)
  const b = byTitle(blocks)
  assert.deepEqual([b['Red-eye'].startMin, b['Red-eye'].endMin], [1380, 1440])
  assert.deepEqual([b['Late night'].startMin, b['Late night'].endMin], [0, 60])
})

t('an empty day still shows the working hours', () => {
  const layout = layoutDay([], DAY)
  assert.deepEqual([layout.startHour, layout.endHour, layout.blocks.length], [DEFAULT_START_HOUR, DEFAULT_END_HOUR, 0])
})

t('time ranges read like Google’s', () => {
  assert.equal(formatTimeRange(at(14), at(15)), '2:00 – 3:00 PM')
  assert.equal(formatTimeRange(at(11, 30), at(12, 15)), '11:30 AM – 12:15 PM')
  assert.equal(formatTimeRange(at(9), null), '9:00 AM')
})

console.log(`dayView: ${passed} passed`)
