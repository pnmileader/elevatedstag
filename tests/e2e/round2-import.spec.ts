import { test, expect } from '@playwright/test'
import path from 'node:path'

// Import page, round 2. These tests only parse files in the browser — nothing is
// submitted, so nothing is written to the live database. The fixture's only
// customer uses the e2e marker last name (Zz-E2E-Playwright) in case a future
// test does submit it; cleanup() in fixtures.ts removes clients with that name.
const SALES_REPORT = path.join(__dirname, 'fixtures', 'sales-by-customer-detail.csv')

test.describe('Import: Sales by Customer Detail dropped in the wrong zone', () => {
  test('Clients zone says the report belongs in Purchase History, and Move hands it over', async ({ page }) => {
    await page.goto('/settings/import')
    const clientsZone = page.getByTestId('import-zone-clients')
    const purchasesZone = page.getByTestId('import-zone-purchases')

    await clientsZone.locator('input[type="file"]').setInputFiles(SALES_REPORT)

    const notice = clientsZone.getByTestId('sales-report-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Sales by Customer Detail')
    await expect(notice).toContainText('belongs in Import Purchase History')
    // No broken one-column mapping, no "Map at least" dead end.
    await expect(clientsZone).not.toContainText('Map at least')
    await expect(clientsZone).not.toContainText('Column mapping')

    const move = notice.getByTestId('move-to-purchases')
    const box = await move.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await move.click()

    // The clients zone is empty again; the purchases zone has the parsed report, ready to confirm.
    await expect(clientsZone.getByTestId('sales-report-notice')).toHaveCount(0)
    await expect(clientsZone).toContainText('Drop your file here')
    await expect(purchasesZone).toContainText('sales-by-customer-detail.csv')
    await expect(purchasesZone).toContainText('QBO grouped report (auto-flattened)')
    await expect(purchasesZone).toContainText('Zz-E2E-Playwright')
    await expect(purchasesZone.getByRole('button', { name: /Confirm Import \(2 rows\)/ })).toBeEnabled()
    await expect(page.getByTestId('purchases-zone-anchor')).toBeFocused()
    await expect(page.getByTestId('purchases-zone-anchor')).toBeInViewport()
  })

  test('a clients file whose header row has a single heading explains what went wrong', async ({ page }) => {
    await page.goto('/settings/import')
    const clientsZone = page.getByTestId('import-zone-clients')
    await clientsZone.locator('input[type="file"]').setInputFiles({
      name: 'titled-list.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('The Elevated Stag,,\nCustomer Contact List,,\nName,Email,Phone\nRowan Zz-E2E-Playwright,delivered@resend.dev,\n'),
    })
    const notice = clientsZone.getByTestId('single-header-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Only one column heading was found')
    await expect(notice).toContainText('The Elevated Stag')
    await expect(notice).toContainText('Export to Excel')
    await expect(clientsZone).not.toContainText('Map at least')
    await expect(clientsZone.getByRole('button', { name: /Confirm Import/ })).toBeDisabled()
  })
})
