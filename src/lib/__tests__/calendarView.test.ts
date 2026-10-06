// Run with: TZ=America/Chicago npx tsx src/lib/__tests__/calendarView.test.ts
import assert from 'node:assert/strict'
import { buildCalendarDays } from '../calendarView'

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${name}`) }
const harish = { first_name: 'Harish', last_name: 'Abbott' }

t('appointments, care items and Google events land on the right days in the right order', () => {
  const days = buildCalendarDays(
    [
      { id: 'a1', title: null, appointment_type: 'fitting', start_time: new Date(2026, 9, 5, 10, 0).toISOString(), location: 'Studio', client_id: 'h', client: harish },
      { id: 'a2', title: 'Late fitting', appointment_type: 'fitting', start_time: new Date(2026, 9, 5, 21, 30).toISOString(), location: null, client_id: null },
    ],
    [{ id: 'c1', title: 'Needs shirts', item_type: 'follow_up_2week', due_date: '2026-10-05', client_id: 'h', client: harish }],
    [
      { id: 'g1', title: 'Staff meeting', start: new Date(2026, 9, 5, 9, 0).toISOString(), end: new Date(2026, 9, 5, 9, 30).toISOString(), allDay: false, location: null },
      { id: 'g2', title: 'Trunk show', start: '2026-10-06', end: '2026-10-07', allDay: true, location: null },
    ],
  )
  assert.deepEqual(days.map((d) => d.day), ['2026-10-05', '2026-10-06'])
  assert.deepEqual(days[0].entries.map((e) => e.title), ['Follow Up: Needs shirts', 'Staff meeting', 'Fitting', 'Late fitting'])
  assert.equal(days[0].entries[2].clientName, 'Harish Abbott')
  assert.equal(days[0].entries[0].kind, 'care')
  assert.equal(days[1].entries[0].kind, 'google')
  assert.equal(days[1].entries[0].allDay, true)
})

t('a 9:30pm appointment stays on its local day (not pushed to tomorrow by UTC)', () => {
  const days = buildCalendarDays(
    [{ id: 'a', title: 'Late', appointment_type: null, start_time: new Date(2026, 9, 5, 21, 30).toISOString(), location: null, client_id: null }],
    [],
    [],
  )
  assert.equal(days[0].day, '2026-10-05')
})

console.log(`calendarView: ${passed} passed`)
