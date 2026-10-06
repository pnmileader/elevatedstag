import { test, expect, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signedInDb, ensureTestClient, cleanup } from './fixtures'

// Round 2: Shirt Measurements reworked into Trinity-style rows with calculated
// finished totals (actual + fit, in eighths).

let db: SupabaseClient
let testClientId: string

test.beforeAll(async () => {
  db = await signedInDb()
  await cleanup(db)
  testClientId = await ensureTestClient(db, 'Shirty')
})

test.afterAll(async () => {
  await cleanup(db)
})

const whole = (page: Page, key: string) => page.locator(`input[data-field="${key}"]`)
const fraction = (page: Page, key: string) => page.locator(`select[name="shirt.${key}.fraction"]`)
const total = (page: Page, key: string) => page.locator(`output[data-field="${key}"]`)

async function enter(page: Page, key: string, w: string, f = '') {
  await whole(page, key).fill(w)
  if (f) await fraction(page, key).selectOption(f)
}

async function shirtRow(): Promise<Record<string, string>> {
  const { data } = await db
    .from('measurements')
    .select('measurements')
    .eq('client_id', testClientId)
    .eq('category', 'shirt')
    .maybeSingle()
  return (data?.measurements as Record<string, string>) || {}
}

test.describe('Round 2 — Shirt measurements', () => {
  test('finished totals add actual + fit with fraction carry, save, and persist', async ({ page }) => {
    await page.goto(`/clients/${testClientId}/measurements`)
    await expect(whole(page, 'actual_chest')).toBeVisible()

    // The total is display-only: no input for it, and nothing shown until the actual is entered.
    await expect(page.locator('input[data-field="finished_chest"]')).toHaveCount(0)
    await expect(total(page, 'finished_chest')).toHaveAttribute('data-value', '')

    // 39 1/4 + 5 = 44 1/4
    await enter(page, 'actual_chest', '39', '1/4')
    await expect(total(page, 'finished_chest')).toHaveAttribute('data-value', '39 1/4') // fit blank counts as 0
    await enter(page, 'chest_fit', '5')
    await expect(total(page, 'finished_chest')).toHaveAttribute('data-value', '44 1/4')
    await expect(total(page, 'finished_chest')).toContainText('44')
    await expect(total(page, 'finished_chest')).toContainText('1/4')

    // 35 1/2 + 4 3/4 = 40 1/4 (eighths carry into the whole number)
    await enter(page, 'actual_waist', '35', '1/2')
    await enter(page, 'waist_fit', '4', '3/4')
    await expect(total(page, 'finished_waist')).toHaveAttribute('data-value', '40 1/4')

    // 40 7/8 + 1/8 = 41 (no fraction left)
    await enter(page, 'actual_hips', '40', '7/8')
    await enter(page, 'hips_fit', '', '1/8')
    await expect(total(page, 'finished_hips')).toHaveAttribute('data-value', '41')

    // New fields + an existing one that moved rows
    await enter(page, 'finished_collar', '16', '1/2')
    await enter(page, 'finished_short_sleeve_left', '9', '1/2')
    await enter(page, 'finished_short_sleeve_right', '9', '3/4')
    await enter(page, 'finished_length', '31', '1/8')
    await enter(page, 'finished_sleeve_left', '34', '5/8')

    await page.getByTestId('save-measurements').click()
    await expect(page.getByTestId('measurements-saved')).toBeVisible()

    // Totals are written into the shirt JSON in the stored "44 1/4" format.
    const saved = await shirtRow()
    expect(saved.finished_chest).toBe('44 1/4')
    expect(saved.finished_waist).toBe('40 1/4')
    expect(saved.finished_hips).toBe('41')
    expect(saved.finished_short_sleeve_left).toBe('9 1/2')
    expect(saved.finished_short_sleeve_right).toBe('9 3/4')
    expect(saved.finished_length).toBe('31 1/8')

    await page.reload()
    await expect(whole(page, 'actual_chest')).toHaveValue('39')
    await expect(fraction(page, 'actual_chest')).toHaveValue('1/4')
    await expect(whole(page, 'chest_fit')).toHaveValue('5')
    await expect(total(page, 'finished_chest')).toHaveAttribute('data-value', '44 1/4')
    await expect(total(page, 'finished_waist')).toHaveAttribute('data-value', '40 1/4')
    await expect(total(page, 'finished_hips')).toHaveAttribute('data-value', '41')
    await expect(whole(page, 'finished_collar')).toHaveValue('16')
    await expect(whole(page, 'finished_short_sleeve_left')).toHaveValue('9')
    await expect(fraction(page, 'finished_short_sleeve_left')).toHaveValue('1/2')
    await expect(whole(page, 'finished_short_sleeve_right')).toHaveValue('9')
    await expect(fraction(page, 'finished_short_sleeve_right')).toHaveValue('3/4')
    await expect(whole(page, 'finished_length')).toHaveValue('31')
    await expect(fraction(page, 'finished_length')).toHaveValue('1/8')
    await expect(whole(page, 'finished_sleeve_left')).toHaveValue('34')
    await expect(fraction(page, 'finished_sleeve_left')).toHaveValue('5/8')
  })

  test('a stale stored total is recomputed from actual + fit on load', async ({ page }) => {
    const row = await shirtRow()
    await db
      .from('measurements')
      .update({ measurements: { ...row, actual_chest: '40', chest_fit: '4', finished_chest: '99' } })
      .eq('client_id', testClientId)
      .eq('category', 'shirt')
    await page.goto(`/clients/${testClientId}/measurements`)
    await expect(total(page, 'finished_chest')).toHaveAttribute('data-value', '44')
  })

  test('at iPad width the chest row reads Actual + Fit = Total on one line', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`/clients/${testClientId}/measurements`)
    await expect(whole(page, 'actual_chest')).toBeVisible()
    const [a, f, t] = await Promise.all(
      [whole(page, 'actual_chest'), whole(page, 'chest_fit'), total(page, 'finished_chest')].map(async (l) => (await l.boundingBox())!),
    )
    expect(Math.abs(a.y - f.y)).toBeLessThan(4)
    expect(Math.abs(a.y - t.y)).toBeLessThan(4)
    expect(a.x).toBeLessThan(f.x)
    expect(f.x).toBeLessThan(t.x)
  })

  test('at iPhone width the shirt rows fit without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/clients/${testClientId}/measurements`)
    const shirt = page.getByTestId('acc-shirt')
    await shirt.getByRole('button', { name: 'Shirt Measurements' }).tap()
    await expect(shirt).toHaveAttribute('data-open', 'true')
    await expect(whole(page, 'actual_chest')).toBeVisible()
    // <main> clips horizontal overflow, so check every control stays inside the card instead.
    const section = (await page.getByTestId('shirt-measurements').boundingBox())!
    const right = section.x + section.width + 1
    const controls = page.getByTestId('shirt-measurements').locator('input, select, output')
    const n = await controls.count()
    expect(n).toBeGreaterThan(30)
    for (let i = 0; i < n; i++) {
      const box = (await controls.nth(i).boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(right)
    }
    // Actual + Fit still share a line; "= Finished Chest" may drop under, but never sits left of the fit.
    const [a, f] = await Promise.all([whole(page, 'actual_chest'), whole(page, 'chest_fit')].map(async (l) => (await l.boundingBox())!))
    expect(Math.abs(a.y - f.y)).toBeLessThan(4)
  })
})
