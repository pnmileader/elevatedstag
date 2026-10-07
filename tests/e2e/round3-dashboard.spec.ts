import { test, expect, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, ensureTestClient, cleanup } from './fixtures'

// Round 3: Katie's dashboard — Care Items Due (To Dos / Follow Ups, add/edit/complete/delete with a
// client lookup), This Week, and Overdue for an Appointment (no purchase in 6+ months, with phone).

let db: SupabaseClient
let dashyId: string
let lapsedId: string
let recentId: string

function isoMonthsAgo(months: number, extraDays = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(d.getDate() - extraDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.beforeAll(async () => {
  db = await signedInDb()
  await cleanup(db)
  dashyId = await ensureTestClient(db, 'Dashy')
  lapsedId = await ensureTestClient(db, 'Lapsed')
  recentId = await ensureTestClient(db, 'Recent')
  await db.from('clients').update({ last_purchase_date: isoMonthsAgo(6, 3), phone: '(512) 555-0142' }).eq('id', lapsedId)
  await db.from('clients').update({ last_purchase_date: isoMonthsAgo(3), phone: '(512) 555-0199' }).eq('id', recentId)
})

test.afterAll(async () => {
  await cleanup(db)
})

async function openDashboard(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-content')).toBeVisible()
}

test.describe('Round 3 — Dashboard', () => {
  test('shows only Care Items Due, This Week, and Overdue for an Appointment', async ({ page }) => {
    await openDashboard(page)
    await expect(page.getByTestId('dash-care')).toBeVisible()
    await expect(page.getByTestId('dash-week')).toBeVisible()
    await expect(page.getByTestId('dash-overdue')).toBeVisible()
    for (const gone of ['Revenue', 'Clients by Stage', 'Needs Follow-Up', 'Recent Orders', 'Deadlines']) {
      await expect(page.getByText(gone, { exact: true })).toHaveCount(0)
    }
  })

  test('add a To Do for a client, edit it into a Follow Up, then mark it done', async ({ page }) => {
    await openDashboard(page)
    await page.getByTestId('dash-care-add').click()
    const form = page.getByTestId('care-form')
    await form.getByTestId('care-type-select').selectOption('to_do')
    await form.getByTestId('care-title-input').fill('E2E dash pick up suit')
    await form.getByTestId('care-due-input').fill(isoMonthsAgo(0))
    await form.getByTestId('care-client-input').fill('Dashy Zz-E2E')
    await form.getByTestId('care-client-option').filter({ hasText: 'Dashy' }).first().click()
    await form.getByTestId('care-save').click()

    const todos = page.getByTestId('dash-care-todos')
    const row = todos.getByTestId('dash-care-row').filter({ hasText: 'E2E dash pick up suit' })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Dashy')
    const { data: created } = await db.from('client_care_items').select('id, client_id, item_type, completed').eq('title', 'E2E dash pick up suit').single()
    expect(created).toMatchObject({ client_id: dashyId, item_type: 'to_do', completed: false })

    // It shows on the client's own page too.
    await page.goto(`/clients/${dashyId}`)
    await expect(page.getByText('E2E dash pick up suit')).toBeVisible()

    // Edit → Follow Up moves it to the Follow Ups list.
    await openDashboard(page)
    await page.getByTestId('dash-care-row').filter({ hasText: 'E2E dash pick up suit' }).getByTestId('dash-care-edit').click()
    await page.getByTestId('care-form').getByTestId('care-type-select').selectOption('follow_up')
    await page.getByTestId('care-form').getByTestId('care-save').click()
    const followRow = page.getByTestId('dash-care-followups').getByTestId('dash-care-row').filter({ hasText: 'E2E dash pick up suit' })
    await expect(followRow).toBeVisible()
    await expect(page.getByTestId('dash-care-todos').getByText('E2E dash pick up suit')).toHaveCount(0)

    // Complete.
    await followRow.getByRole('checkbox').click()
    await expect(page.getByTestId('dash-care-row').filter({ hasText: 'E2E dash pick up suit' })).toHaveCount(0)
    const { data: done } = await db.from('client_care_items').select('item_type, completed').eq('id', created!.id).single()
    expect(done).toEqual({ item_type: 'follow_up', completed: true })
  })

  test('delete asks first, then removes the item', async ({ page }) => {
    await db.from('client_care_items').insert({ client_id: dashyId, item_type: 'follow_up', title: 'E2E dash delete me', completed: false })
    await openDashboard(page)
    const row = page.getByTestId('dash-care-row').filter({ hasText: 'E2E dash delete me' })
    await row.getByTestId('dash-care-delete').click()
    await expect(page.getByTestId('confirm-modal')).toBeVisible()
    await page.getByTestId('confirm-modal').getByRole('button', { name: 'Delete' }).click()
    await expect(row).toHaveCount(0)
    const { data } = await db.from('client_care_items').select('id').eq('title', 'E2E dash delete me')
    expect(data).toEqual([])
  })

  test('This Week shows a CRM appointment in the next 7 days', async ({ page }) => {
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(14, 0, 0, 0)
    const res = await page.request.post('/api/appointments', {
      data: { client_id: dashyId, appointment_type: 'fitting', title: 'E2E Dash Fitting', start_time: start.toISOString(), end_time: new Date(start.getTime() + 3_600_000).toISOString() },
    })
    expect(res.status()).toBeLessThan(300)
    await openDashboard(page)
    const week = page.getByTestId('dash-week')
    await expect(week.getByText('E2E Dash Fitting')).toBeVisible()
    await expect(week).toContainText('2:00 PM')
  })

  test('Overdue for an Appointment lists clients with no purchase in 6+ months, with a tap-to-call phone', async ({ page }) => {
    await openDashboard(page)
    const section = page.getByTestId('dash-overdue')
    const toggle = section.getByTestId('dash-overdue-toggle')
    if (await toggle.count()) await toggle.click()
    const lapsed = section.getByTestId('dash-overdue-row').filter({ hasText: 'Lapsed' })
    await expect(lapsed).toBeVisible()
    await expect(lapsed.getByTestId('dash-overdue-phone')).toHaveAttribute('href', 'tel:5125550142')
    await expect(section.getByTestId('dash-overdue-row').filter({ hasText: 'Recent Zz-E2E' })).toHaveCount(0)
    await expect(section.locator('select')).toHaveCount(0) // no time-frame dropdown
  })
})
