import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, ensureTestClient, cleanup } from './fixtures'

// Round 2: Client Care (Thank You Note line, To Do / Follow Up labels, correct due dates),
// swatch photo upload, and the calendar (care items + invite to Katie's own calendar).

let db: SupabaseClient
let testClientId: string

// 1×1 PNG — enough for the browser to decode, shrink, and re-encode as JPEG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')

function todayLocal() {
  const d = new Date()
  return {
    iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    shown: d.toLocaleDateString('en-US'),
  }
}

async function removeSwatchFiles() {
  const { data } = await db.storage.from('client-photos').list(`swatches/${testClientId}`)
  if (data?.length) await db.storage.from('client-photos').remove(data.map((f) => `swatches/${testClientId}/${f.name}`))
}

test.beforeAll(async () => {
  db = await signedInDb()
  await cleanup(db)
  testClientId = await ensureTestClient(db, 'Carey')
})

test.afterAll(async () => {
  await removeSwatchFiles()
  await cleanup(db)
})

test.describe('Round 2 — Client Care', () => {
  test('the fixed Thank You Note line checks off and back on', async ({ page }) => {
    await page.goto(`/clients/${testClientId}`)
    const toggle = page.getByTestId('care-thank-you-toggle')
    const status = page.getByTestId('care-thank-you-status')
    await expect(status).toHaveText('Not sent yet')
    await toggle.scrollIntoViewIfNeeded()
    const box = (await toggle.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)

    await toggle.click()
    await expect(status).toHaveText(`Sent ${todayLocal().shown}`)
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    const { data } = await db.from('client_care_items').select('item_type, completed').eq('client_id', testClientId).eq('item_type', 'thank_you_note')
    expect(data).toEqual([{ item_type: 'thank_you_note', completed: true }])

    await page.reload()
    await expect(page.getByTestId('care-thank-you-status')).toHaveText(`Sent ${todayLocal().shown}`)
    await page.getByTestId('care-thank-you-toggle').click()
    await expect(page.getByTestId('care-thank-you-status')).toHaveText('Not sent yet')
  })

  test('Follow Up keeps its label, shows the due date she picked, and appears on the dashboard + calendar', async ({ page }) => {
    const { iso, shown } = todayLocal()
    await page.goto(`/clients/${testClientId}`)
    await page.getByTestId('care-add-item').click()
    const typeSelect = page.getByTestId('care-type-select')
    await expect(typeSelect.locator('option')).toHaveText(['To Do', 'Follow Up'])
    await typeSelect.selectOption('follow_up')
    await page.getByTestId('care-due-input').fill(iso)
    await page.getByTestId('care-title-input').fill('E2E shirts')
    await page.getByTestId('care-save').click()

    const row = page.locator('p', { hasText: 'E2E shirts' })
    await expect(row).toHaveText('Follow Up: E2E shirts')
    await expect(page.getByText(`Due: ${shown}`)).toBeVisible() // the day she picked, not the day before
    const { data } = await db.from('client_care_items').select('item_type, due_date').eq('client_id', testClientId).eq('title', 'E2E shirts').single()
    expect(data).toEqual({ item_type: 'follow_up', due_date: iso })

    await page.goto('/')
    const dash = page.locator('a', { hasText: 'E2E shirts' })
    await expect(dash).toContainText('Follow Up:')
    await expect(dash).not.toContainText('Overdue') // due today is not overdue

    await page.goto('/calendar')
    const entry = page.getByTestId('cal-entry-care').filter({ hasText: 'E2E shirts' })
    await expect(entry).toContainText('Follow Up: E2E shirts')
    await expect(entry).toContainText('Carey')
  })
})

test.describe('Round 2 — Swatch upload', () => {
  test('add a photo from the order, then replace it via Upload Swatch; the old file is removed', async ({ page }) => {
    const { iso } = todayLocal()
    const { data: order, error } = await db
      .from('custom_orders')
      .insert({ client_id: testClientId, garment_type: 'Suit', fabric_name: 'E2E Navy', fabric_code: 'E2E-001', status: 'ordered', order_date: iso, price: 1 })
      .select('id')
      .single()
    expect(error).toBeNull()

    await page.goto(`/clients/${testClientId}/swatches`)
    await page.getByText('E2E Navy').first().click()
    const add = page.getByTestId('swatch-add-photo')
    await expect(add).toHaveText(/Add Swatch Photo/)
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), add.click()])
    await chooser.setFiles({ name: 'swatch.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('Swatch photo saved')).toBeVisible()
    await expect(add).toHaveText(/Replace Photo/)

    const first = await db.from('custom_orders').select('swatch_image_url').eq('id', order!.id).single()
    expect(first.data?.swatch_image_url).toContain(`/client-photos/swatches/${testClientId}/${order!.id}-`)
    expect((await page.request.get(first.data!.swatch_image_url!)).status()).toBe(200)

    // Header button → choose the order → new photo replaces the old one.
    await page.keyboard.press('Escape')
    await page.getByTestId('swatch-upload-open').click()
    await expect(page.getByTestId('swatch-order-chooser')).toBeVisible()
    const [chooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('swatch-order-chooser').getByText('E2E Navy').click(),
    ])
    await chooser2.setFiles({ name: 'swatch2.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('Swatch photo saved').first()).toBeVisible()
    await expect.poll(async () => (await db.from('custom_orders').select('swatch_image_url').eq('id', order!.id).single()).data?.swatch_image_url).not.toBe(first.data?.swatch_image_url)

    const { data: files } = await db.storage.from('client-photos').list(`swatches/${testClientId}`)
    expect(files?.length).toBe(1)
  })
})

test.describe('Round 2 — Calendar', () => {
  test('test clients never send Katie a calendar invite', async ({ page }) => {
    const start = new Date(); start.setDate(start.getDate() + 2); start.setHours(11, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const res = await page.request.post('/api/appointments', {
      data: { client_id: testClientId, appointment_type: 'fitting', title: 'E2E Owner Invite Check', start_time: start.toISOString(), end_time: end.toISOString() },
    })
    expect(res.status()).toBeLessThan(300)
    expect((await res.json()).ownerInviteSent).toBe(false)
  })

  test('the Google Calendar feed endpoint needs a login and answers for the current week', async ({ page, playwright }) => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 7 * 86_400_000)
    const qs = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
    const res = await page.request.get(`/api/calendar/google?${qs}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.configured).toBe('boolean')
    expect(Array.isArray(body.events)).toBe(true)

    // A context with no saved login must be turned away (API routes check auth themselves).
    const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL, storageState: { cookies: [], origins: [] } })
    expect((await anon.get(`/api/calendar/google?${qs}`)).status()).toBe(401)
    await anon.dispose()
  })
})
