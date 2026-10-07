import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, ensureTestClient, cleanup, E2E_LAST_NAME, E2E_SINK_EMAIL } from './fixtures'

let db: SupabaseClient
let testClientId: string

test.beforeAll(async () => {
  db = await signedInDb()
  await cleanup(db)
  testClientId = await ensureTestClient(db)
})

test.afterAll(async () => {
  await cleanup(db)
})

// ---------------------------------------------------------------------------
// SECTION 1 — critical bugs
// ---------------------------------------------------------------------------
test.describe('1. Navigation + search', () => {
  test('1.1 search icon opens a field that accepts input and returns results', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('search-icon').click()
    const input = page.getByTestId('search-input')
    await expect(input).toBeFocused()
    await input.pressSequentially('James')
    const hit = page.getByTestId('search-result').filter({ hasText: 'James Bettersworth' })
    await expect(hit).toBeVisible()
    await hit.click()
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'James Bettersworth' })).toBeVisible()
  })

  test('1.1 search works at iPhone width and matches first + last name together', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/orders')
    await page.getByTestId('search-icon').click()
    await page.getByTestId('search-input').pressSequentially('james bett')
    await expect(page.getByTestId('search-result').filter({ hasText: 'James Bettersworth' })).toBeVisible()
    await page.getByTestId('search-close').click()
    await expect(page.getByTestId('search-input')).toHaveCount(0)
  })
})

test.describe('1. Measurements', () => {
  test('1.2 fields accept multi-digit typing without losing focus', async ({ page }) => {
    await page.goto(`/clients/${testClientId}/measurements`)
    const weight = page.locator('input[data-field="weight"]')
    await weight.click()
    // Real keystrokes (not fill): the old bug dropped focus after the first digit.
    await page.keyboard.type('165', { delay: 40 })
    await expect(weight).toHaveValue('165')
    await expect(weight).toBeFocused()

    const chest = page.locator('input[name="coat.chest"]')
    await chest.click()
    await page.keyboard.type('42', { delay: 40 })
    await page.keyboard.press('Backspace')
    await page.keyboard.type('4', { delay: 40 })
    await expect(chest).toHaveValue('44')
    await expect(chest).toBeFocused()
  })

  test('1.3 height is feet + inches, displays as 5\' 9", and persists', async ({ page }) => {
    await page.goto(`/clients/${testClientId}/measurements`)
    await expect(page.getByText('Feet', { exact: true })).toBeVisible()
    await page.locator('input[name="height_feet"]').fill('5')
    await page.locator('input[name="height_inches"]').fill('9')
    await expect(page.getByTestId('height-display')).toHaveText('5\' 9"')
    // no fraction dropdown on the height row
    await expect(page.locator('select[name="body.height.fraction"]')).toHaveCount(0)

    await page.getByTestId('save-measurements').click()
    await expect(page.getByTestId('measurements-saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('input[name="height_feet"]')).toHaveValue('5')
    await expect(page.locator('input[name="height_inches"]')).toHaveValue('9')
    await expect(page.getByTestId('height-display')).toHaveText('5\' 9"')
  })

  test('1.4 + 1.5 Incline sits above Shoulder Reading (L) and (R)', async ({ page }) => {
    await page.goto(`/clients/${testClientId}/measurements`)
    const incline = page.getByText('Incline', { exact: true })
    const left = page.getByText('Shoulder Reading (L)', { exact: true })
    const right = page.getByText('Shoulder Reading (R)', { exact: true })
    await expect(incline).toBeVisible()
    await expect(left).toBeVisible()
    await expect(right).toBeVisible()
    const [iy, ly, ry] = await Promise.all([incline, left, right].map(async (l) => (await l.boundingBox())!.y))
    expect(iy).toBeLessThan(ly)
    expect(ly).toBeLessThan(ry)
    await expect(page.locator('input[name="body.incline"]')).toBeVisible()
    await expect(page.locator('select[name="body.incline.fraction"]')).toBeVisible()
  })
})

test.describe('1. Email', () => {
  test('1.6 + 1.7 sent email has the real first name, real line breaks, and sends successfully', async ({ page }) => {
    // Body deliberately uses the broken stored form: raw placeholder + literal backslash-n.
    const res = await page.request.post('/api/email/send', {
      data: {
        clientId: testClientId,
        to: E2E_SINK_EMAIL, // Resend's test inbox — never a real client
        subject: 'E2E hello {FIRST_NAME}',
        emailBody: 'Hi {FIRST_NAME},\\n\\nLine two.\\n\\nAll my best,\\nKatie',
      },
    })
    const json = await res.json()
    expect(res.status(), JSON.stringify(json)).toBe(200)
    expect(json.from).toMatch(/Katie Fore <katie@(mail\.)?theelevatedstag\.com>/)
    console.log(`      sender used: ${json.from}`)

    const { data: rows } = await db
      .from('sent_emails')
      .select('subject, body, client_id')
      .eq('to_email', E2E_SINK_EMAIL)
      .order('sent_at', { ascending: false })
      .limit(1)
    const sent = rows![0]
    expect(sent.client_id).toBe(testClientId)
    expect(sent.subject).toBe('E2E hello Testy')
    expect(sent.body).toContain('Hi Testy,')
    expect(sent.body).not.toContain('{FIRST_NAME}')
    expect(sent.body).not.toContain('\\n') // no literal backslash-n
    expect(sent.body.split('\n').length).toBeGreaterThan(3) // real line breaks
  })

  test('1.6 choosing a template shows real line breaks in the editor', async ({ page }) => {
    await page.goto('/email/compose?template=')
    await page.getByTestId('compose-template').selectOption({ label: 'Appointment Outreach' })
    const body = page.locator('textarea')
    await expect(body).toHaveValue(/Hi \{FIRST_NAME\},\n\nI hope all is well!/)
    expect(await body.inputValue()).not.toContain('\\n')
  })
})

test.describe('1. Client care (mobile)', () => {
  test('1.8 Add Item works at 375px with a 44px tap target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/clients/${testClientId}`)
    const add = page.getByTestId('care-add-item')
    await add.scrollIntoViewIfNeeded()
    const box = (await add.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
    await add.tap()
    await page.getByTestId('care-title-input').fill('E2E thank-you note')
    await page.getByTestId('care-save').tap()
    await expect(page.getByText('E2E thank-you note')).toBeVisible()
  })
})

// Dashboard tests moved to round3-dashboard.spec.ts (Katie's Oct 2026 dashboard: care items, week, call list).

// ---------------------------------------------------------------------------
// SECTION 3 — features
// ---------------------------------------------------------------------------
test.describe('3. Email selectors', () => {
  test('3.1 Quick Send client selector is a typeahead that matches any part of the name', async ({ page }) => {
    await page.goto('/email')
    const input = page.getByTestId('client-selector-input')
    await input.click()
    await input.pressSequentially('Bet')
    const option = page.getByTestId('client-selector-option').filter({ hasText: 'James Bettersworth' })
    await expect(option).toBeVisible()
    await option.click()
    await expect(page.getByTestId('client-selector-selected')).toContainText('James Bettersworth')
    await expect(page.locator('input[type="email"]')).toHaveValue(/@/)
  })

  test('3.1 Compose single-client selector is the same typeahead', async ({ page }) => {
    await page.goto('/email/compose')
    await page.getByTestId('client-selector-input').pressSequentially('bettersworth james')
    await page.getByTestId('client-selector-option').filter({ hasText: 'James Bettersworth' }).click()
    await expect(page.getByTestId('compose-send')).toContainText('Send to 1 recipient')
  })

  test('3.2 group email lists every match with a checkbox and lets her uncheck people', async ({ page }) => {
    await page.goto('/email/compose')
    await page.getByRole('button', { name: 'By City' }).click()
    const city = page.getByTestId('group-city')
    const options = await city.locator('option').allTextContents()
    // pick the city with the most clients so there are at least 3 rows
    let best = ''
    let bestCount = 0
    for (const name of options.filter((o) => o && !o.startsWith('Select'))) {
      await city.selectOption({ label: name })
      const n = await page.getByTestId('recipient-row').count()
      if (n > bestCount) { best = name; bestCount = n }
      if (bestCount >= 5) break
    }
    await city.selectOption({ label: best })
    const boxes = page.getByTestId('recipient-checkbox')
    const total = await boxes.count()
    expect(total).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < total; i++) await expect(boxes.nth(i)).toBeChecked()
    await expect(page.getByTestId('recipient-count')).toContainText(`Sending to ${total} of ${total} client`)

    await boxes.nth(0).uncheck()
    await boxes.nth(1).uncheck()
    await expect(page.getByTestId('recipient-count')).toContainText(`Sending to ${total - 2} of ${total} client`)
    await expect(page.getByTestId('compose-send')).toContainText(`Send to ${total - 2} recipient`)
  })

  test('3.3 + 3.4 By Tag lists every tag, and Last Purchase narrows a group', async ({ page }) => {
    await page.goto('/email/compose')
    await page.getByRole('button', { name: 'By Tag' }).click()
    await expect(page.getByTestId('group-tag').locator('option', { hasText: 'E2E' })).toHaveCount(1)
    await page.getByTestId('group-tag').selectOption('E2E')
    await expect(page.getByTestId('recipient-row')).toHaveCount(1)
    await page.getByTestId('group-last-purchase').selectOption('never')
    await expect(page.getByTestId('recipient-row')).toHaveCount(1) // the fixture client has never purchased
    await page.getByTestId('group-last-purchase').selectOption('under_3')
    await expect(page.getByTestId('recipient-row')).toHaveCount(0)
  })
})

test.describe('3. Clients list', () => {
  test('client list loads, and search filters as you type', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.getByTestId('client-card').first()).toBeVisible()
    await page.getByTestId('client-search').fill('james bettersworth')
    await expect(page.getByTestId('client-card')).toHaveCount(1)
    await expect(page.getByTestId('client-card').first()).toContainText('James Bettersworth')
  })

  test('6.1 dashboard stage links arrive pre-filtered', async ({ page }) => {
    await page.goto('/clients?stage=lead')
    await expect(page.getByTestId('stage-lead')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('client-card').filter({ hasText: E2E_LAST_NAME })).toBeVisible()
  })

  test('3.3 Filter by Tag + 3.4 Last Purchase filter', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.getByTestId('client-card').first()).toBeVisible()
    await page.getByTestId('filter-tag').selectOption('E2E')
    await expect(page.getByTestId('client-card')).toHaveCount(1)
    await page.getByTestId('clear-filters').click()

    const all = await page.getByTestId('client-count').innerText()
    await page.getByTestId('filter-last-purchase').selectOption('never')
    await expect(page.getByTestId('client-count')).not.toHaveText(all)
    const { count } = await db.from('clients').select('id', { count: 'exact', head: true }).is('last_purchase_date', null)
    await expect(page.getByTestId('client-count')).toHaveText(`${count} clients`)
  })

  test('3.5 bulk delete: select mode, select all, confirm modal, delete', async ({ page }) => {
    const doomedA = await ensureTestClient(db, 'DeleteMeA')
    const doomedB = await ensureTestClient(db, 'DeleteMeB')
    await page.goto('/clients')
    await page.getByTestId('client-search').fill('DeleteMe')
    await expect(page.getByTestId('client-card')).toHaveCount(2)

    await page.getByTestId('select-mode-toggle').click()
    await expect(page.getByTestId('client-checkbox').first()).toBeVisible()
    await expect(page.getByTestId('delete-selected')).toBeDisabled()
    await page.getByTestId('select-all').check()
    await expect(page.getByTestId('delete-selected')).toHaveText(/Delete Selected \(2\)/)

    await page.getByTestId('delete-selected').click()
    const modal = page.getByTestId('confirm-modal')
    await expect(modal).toContainText('Delete 2 clients?')
    await expect(modal).toContainText('cannot be undone')
    await page.getByTestId('confirm-accept').click()

    await expect(page.getByTestId('toast')).toContainText('Deleted 2 clients')
    const { data: left } = await db.from('clients').select('id').in('id', [doomedA, doomedB])
    expect(left).toHaveLength(0)
  })
})

test.describe('3. Client profile', () => {
  test('3.3 tags: add by typing, autocomplete, remove with ×, persists', async ({ page }) => {
    await page.goto(`/clients/${testClientId}`)
    const card = page.getByTestId('client-tags-card')
    await expect(card.getByTestId('tag-chip')).toHaveText(['E2E'])
    await card.getByTestId('tag-input').fill('VP')
    await card.getByTestId('tag-input').press('Enter')
    await expect(card.getByTestId('tags-status')).toHaveText('Saved')
    await expect(card.getByTestId('tag-chip')).toHaveText(['E2E', 'VP'])

    await page.reload()
    await expect(card.getByTestId('tag-chip')).toHaveText(['E2E', 'VP'])
    await card.getByTestId('tag-chip').filter({ hasText: 'VP' }).getByTestId('tag-remove').click()
    await expect(card.getByTestId('tag-chip')).toHaveText(['E2E'])
    await expect(card.getByTestId('tags-status')).toHaveText('Saved')
  })

  test('3.6 Referred By is a searchable client list, and referrals show on the referrer', async ({ page }) => {
    const referrerId = await ensureTestClient(db, 'Referrer')
    await page.goto(`/clients/${testClientId}/edit`)
    const field = page.getByTestId('referred-by')
    await field.scrollIntoViewIfNeeded()
    await field.getByTestId('referred-by-select-input').pressSequentially('Referrer Zz')
    await field.getByTestId('referred-by-select-option').filter({ hasText: `Referrer ${E2E_LAST_NAME}` }).click()
    await page.getByRole('button', { name: /save/i }).first().click()
    await page.waitForURL(new RegExp(`/clients/${testClientId}$`))

    // the referred client links back to the referrer…
    await expect(page.getByTestId('referrer-link')).toHaveText(`Referrer ${E2E_LAST_NAME}`)
    // …and the referrer's profile lists who they referred
    await page.goto(`/clients/${referrerId}`)
    const card = page.getByTestId('client-referrals-card')
    await expect(card.getByTestId('referral-count')).toHaveText('1 referred')
    await expect(card.getByTestId('referral-row')).toContainText(`Testy ${E2E_LAST_NAME}`)
  })

  test('3.10 new client form explains QuickBooks is separate, and saving works', async ({ page }) => {
    await page.goto('/clients/new')
    await expect(page.getByTestId('qb-sync-note')).toContainText('not automatically added to QuickBooks')
    await page.locator('input[name="first_name"]').fill('Test')
    await page.locator('input[name="last_name"]').fill('Playwright')
    await page.locator('input[name="email"]').fill('test@playwright.dev')
    await page.getByRole('button', { name: /save|create|add client/i }).first().click()
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Test Playwright' })).toBeVisible()
  })
})

test.describe('3. Calendar', () => {
  test('3.9 an appointment scheduled in the CRM shows up on the calendar', async ({ page }) => {
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(10, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const res = await page.request.post('/api/appointments', {
      data: { client_id: testClientId, appointment_type: 'fitting', title: 'E2E Fitting', start_time: start.toISOString(), end_time: end.toISOString(), location: 'E2E Studio' },
    })
    expect(res.status(), await res.text()).toBeLessThan(300)
    await page.goto('/calendar')
    await page.getByRole('button', { name: 'Month' }).click()
    await expect(page.getByText('E2E Studio').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// SECTION 4 — transitions.dev motion
// ---------------------------------------------------------------------------
test.describe('4. Transitions', () => {
  test('4.1 pages slide in from the right going forward and from the left going back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Clients' }).click()
    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByTestId('page-transition')).toHaveAttribute('data-dir', 'forward')
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('page-transition')).toHaveAttribute('data-dir', 'back')
    const anim = await page.getByTestId('page-transition').evaluate((el) => getComputedStyle(el).animationName)
    expect(anim).toBe('t-page-in')
  })

  test('4.2 + 4.6 modal scales in/out and the gear menu opens from its top-right origin', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.getByTestId('client-card').first()).toBeVisible()
    await page.getByTestId('gear-icon').click()
    const menu = page.getByTestId('settings-menu')
    await expect(menu).toHaveClass(/t-dropdown/)
    await expect(menu).toHaveClass(/is-open/)
    await expect(menu).toHaveAttribute('data-origin', 'top-right')
    await expect(menu.getByText('Settings')).toBeVisible()
    await expect(menu.getByText('Referrals')).toBeVisible()
    await page.mouse.click(10, 300)
    await expect(menu).toHaveCount(0)

    await expect(page.getByTestId('client-card').first()).toBeVisible()
    await page.getByTestId('select-mode-toggle').click()
    await page.getByTestId('client-checkbox').first().check()
    await page.getByTestId('delete-selected').click()
    const modal = page.getByTestId('confirm-modal')
    await expect(modal).toHaveClass(/t-modal/)
    await expect(modal).toHaveClass(/is-open/)
    await page.getByTestId('confirm-cancel').click() // cancel — nothing is deleted
    await expect(modal).not.toHaveClass(/is-open/)
    await expect(modal).toBeHidden()
  })

  test('4.3 client cards rise in with a stagger', async ({ page }) => {
    await page.goto('/clients')
    const cards = page.getByTestId('client-card')
    await expect(cards.first()).toBeVisible()
    const info = await cards.evaluateAll((els) => els.slice(0, 3).map((el) => ({
      name: getComputedStyle(el).animationName,
      delay: getComputedStyle(el).animationDelay,
    })))
    expect(info.map((i) => i.name)).toEqual(['t-stagger-in', 't-stagger-in', 't-stagger-in'])
    expect(info.map((i) => i.delay)).toEqual(['0s', '0.04s', '0.08s'])
  })

  test('4.4 the tab pill slides to the active tab', async ({ page }) => {
    await page.goto('/email')
    const pill = page.getByTestId('tabs-pill')
    await expect(pill).toHaveAttribute('data-ready', 'true')
    const x = () => pill.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    const before = await x()
    await page.getByRole('tab', { name: 'Sent History' }).click()
    await expect(page.getByRole('tab', { name: 'Sent History' })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(x).toBeGreaterThan(before + 100)
    await expect(page.locator('#panel-sent')).toBeVisible()
  })

  test('4.5 + 4.7 saving shows a toast and a drawn checkmark on the button', async ({ page }) => {
    await page.goto(`/clients/${testClientId}/measurements`)
    await page.locator('input[data-field="weight"]').fill('170')
    await page.getByTestId('save-measurements').click()
    const toast = page.getByTestId('toast')
    await expect(toast).toContainText('Measurements saved')
    await expect(toast).toHaveClass(/is-open/)
    await expect(page.getByTestId('save-measurements').getByTestId('success-check')).toHaveAttribute('data-state', 'in')
    await expect(page.getByTestId('save-measurements')).toContainText('Saved')
    await expect(toast).toHaveCount(0, { timeout: 8000 }) // it dismisses itself
  })

  test('4.8 dashboard shows a skeleton, then the content reveals over it', async ({ page }) => {
    // slow the data down so the skeleton is observable
    await page.route('**/rest/v1/**', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue() })
    await page.goto('/')
    await expect(page.getByTestId('dashboard-skeleton')).toBeVisible()
    await expect(page.getByTestId('dashboard-content')).toBeVisible()
    await expect(page.getByTestId('dashboard-skeleton')).toHaveCount(0)
    await expect(page.getByTestId('dashboard-content')).toHaveClass(/t-skel-content/)
  })

  test('4.10 measurement sections are accordions on a phone and always open on iPad', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/clients/${testClientId}/measurements`)
    const coat = page.getByTestId('acc-coat')
    await expect(page.getByTestId('acc-body')).toHaveAttribute('data-open', 'true')
    await expect(coat).toHaveAttribute('data-open', 'false')
    const panelHeight = () => coat.locator('.t-acc-panel').evaluate((el) => el.getBoundingClientRect().height)
    expect(await panelHeight()).toBeLessThan(2)
    await coat.getByRole('button', { name: 'Coat Measurements' }).tap()
    await expect(coat).toHaveAttribute('data-open', 'true')
    await expect.poll(panelHeight).toBeGreaterThan(200)
    await page.locator('input[name="coat.chest"]').fill('42')
    await expect(page.locator('input[name="coat.chest"]')).toHaveValue('42')

    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await expect(page.locator('input[name="pant.rise"]')).toBeVisible() // closed-by-default section is open at tablet width
  })

  test('respects prefers-reduced-motion', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json', reducedMotion: 'reduce', viewport: { width: 768, height: 1024 } })
    const page = await ctx.newPage()
    await page.goto('/clients')
    await expect(page.getByTestId('client-card').first()).toBeVisible()
    expect(await page.getByTestId('client-card').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    expect(await page.getByTestId('page-transition').evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    await ctx.close()
  })
})

// ---------------------------------------------------------------------------
// SECTION 5 — app-wide smoke tests from the spec
// ---------------------------------------------------------------------------
test.describe('5. Navigation + smoke', () => {
  test('bottom nav tabs all navigate correctly', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    for (const [label, url] of [['Clients', /\/clients$/], ['Orders', /\/orders$/], ['Calendar', /\/calendar$/], ['Email', /\/email$/], ['Dashboard', /\/$/]] as const) {
      await nav.getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(url)
    }
  })

  test('mobile shows the bottom tab bar with 44px+ targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    for (const label of ['Dashboard', 'Clients', 'Orders', 'Calendar', 'Email']) {
      const link = nav.getByRole('link', { name: label })
      await expect(link).toBeVisible()
      const box = (await link.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('dashboard loads with all widgets', async ({ page }) => {
    await page.goto('/')
    for (const heading of ['Care Items Due', 'This Week', 'Overdue for an Appointment']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible()
    }
  })

  test('client profile loads with all sections', async ({ page }) => {
    await page.goto('/clients')
    await page.getByTestId('client-search').fill('james bettersworth')
    await page.getByTestId('client-card').first().click()
    await expect(page.getByRole('heading', { name: 'James Bettersworth' })).toBeVisible()
    for (const section of ['Financial Summary', 'Quick Links', 'Client Care', 'Tags', 'Referrals']) {
      await expect(page.getByRole('heading', { name: section }).first()).toBeVisible()
    }
  })

  test('email templates page loads with templates', async ({ page }) => {
    await page.goto('/email/templates')
    await expect(page.getByText('Appointment Outreach').first()).toBeVisible()
    await expect(page.getByText('Post-Delivery Follow Up').first()).toBeVisible()
  })

  test('navigating the whole app produces no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${msg.text()} @ ${page.url()}`) })
    page.on('pageerror', (err) => errors.push(`${String(err)} @ ${page.url()}`))
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.request().method()} ${res.url().split('?')[0]} ?${(res.url().split('?')[1] || '').slice(0, 120)} @ ${page.url()}`) })
    for (const path of ['/', '/clients', `/clients/${testClientId}`, `/clients/${testClientId}/measurements`, '/orders', '/calendar', '/email', '/email/compose', '/email/templates', '/settings', '/settings/import', '/referrals']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    expect(errors, errors.join('\n')).toEqual([])
  })
})
