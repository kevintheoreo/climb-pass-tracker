import { expect, test, type Page } from '@playwright/test'
import { openAddRow, seedSamples } from './seed'

// Row motion (FR-61): a row moving between the main list and Finished slides. The other browser
// tests run with the phone's reduced-motion setting on (see playwright.config.ts); here it is off.
const mainRows = (page: Page) =>
  page.getByRole('list', { name: 'Passes', exact: true }).locator(':scope > li')
const finishedRows = (page: Page) =>
  page.getByRole('list', { name: 'Finished passes' }).locator(':scope > li')

test.describe('motion allowed', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 360, height: 740 } })

  test('a row that uses its last entry slides out, out of reach, then is in Finished', async ({
    page,
  }) => {
    await seedSamples(page)
    await expect(mainRows(page)).toHaveCount(7)
    await mainRows(page)
      .filter({ hasText: '1 / 1' })
      .getByRole('button', { name: /^Use one entry/ })
      .tap()

    // For a moment the row is still there, sliding out, and cannot be tapped or read out.
    const leaving = page.locator('li.row-leaving')
    await expect(leaving).toHaveCount(1)
    await expect(leaving).toHaveAttribute('inert', '')
    await expect(leaving).toHaveAttribute('aria-hidden', 'true')
    await expect(leaving.getByRole('button')).toHaveCount(0) // none are in the accessibility tree

    // Then it is gone from the main list and in Finished.
    await expect(leaving).toHaveCount(0)
    await expect(mainRows(page)).toHaveCount(6)
    await page.getByText('Finished (3)').tap()
    await expect(finishedRows(page)).toHaveCount(3)
  })

  test('giving the entry back slides the row in from Finished', async ({ page }) => {
    await seedSamples(page)
    await page.getByText('Finished (2)').tap()
    await expect(finishedRows(page)).toHaveCount(2)
    await finishedRows(page)
      .filter({ hasText: '0 / 5' })
      .getByRole('button', { name: /^Give one entry back/ })
      .first()
      .tap()
    await expect(page.locator('li.row-entering')).toHaveCount(1)
    await expect(page.locator('li.row-entering')).toHaveCount(0)
    await expect(mainRows(page)).toHaveCount(8)
    await expect(finishedRows(page)).toHaveCount(1)
  })

  test('the only pass in the list slides out too, and the empty list does not jump', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Gym' }).fill('Solo Wall')
    await page.getByLabel('Entries', { exact: true }).fill('1')
    await page.getByRole('button', { name: '+6 months' }).tap()
    await page.getByRole('button', { name: 'Add pass', exact: true }).tap()
    await expect(mainRows(page)).toHaveCount(1)
    await mainRows(page)
      .getByRole('button', { name: /^Use one entry/ })
      .tap()

    const leaving = page.locator('li.row-leaving')
    await expect(leaving).toHaveCount(1)
    await expect(leaving).toHaveAttribute('inert', '')
    // The list is not given up while the row slides: no "No active passes" jump above it.
    await expect(page.getByText('No active passes.')).toHaveCount(0)
    await expect(leaving).toHaveCount(0)
    await expect(page.getByText('No active passes.')).toBeVisible()
    await page.getByText('Finished (1)').tap()
    await expect(finishedRows(page)).toHaveCount(1)
  })

  test('the only pass in Finished slides back into an empty main list', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Gym' }).fill('Solo Wall')
    await page.getByLabel('Entries', { exact: true }).fill('1')
    await page.getByRole('button', { name: '+6 months' }).tap()
    await page.getByRole('button', { name: 'Add pass', exact: true }).tap()
    await mainRows(page)
      .getByRole('button', { name: /^Use one entry/ })
      .tap()
    await expect(page.locator('li.row-leaving')).toHaveCount(0)
    await page.getByText('Finished (1)').tap()
    await finishedRows(page)
      .getByRole('button', { name: /^Give one entry back/ })
      .first()
      .tap()
    await expect(page.locator('li.row-entering')).toHaveCount(1)
    await expect(page.locator('li.row-entering')).toHaveCount(0)
    await expect(mainRows(page)).toHaveCount(1)
  })

  test('a new pass slides in, with no glow, and the slide class is gone once it has finished', async ({
    page,
  }) => {
    await seedSamples(page)
    await expect(mainRows(page)).toHaveCount(7)
    await openAddRow(page)
    await page.getByRole('combobox', { name: 'Gym' }).fill('Brand New Wall')
    await page.getByLabel('Entries', { exact: true }).fill('5')
    await page.getByRole('button', { name: '+6 months' }).click()
    await page.keyboard.press('Enter')

    const entering = page.locator('li.row-entering')
    await expect(entering).toHaveCount(1)
    await expect(entering).toContainText('Brand New Wall')
    await expect(entering).not.toHaveClass(/ring-amber/) // slides in; it does not glow (D57)
    await expect(entering).toHaveCount(0) // the class goes once it has slid in
    await expect(mainRows(page)).toHaveCount(8)
    await expect(mainRows(page).first()).toContainText('Brand New Wall')
  })

  test('deleting a row does not slide', async ({ page }) => {
    await seedSamples(page)
    await mainRows(page)
      .filter({ hasText: '1 / 1' })
      .getByRole('button', { name: /details$/ })
      .click()
    await page.getByRole('button', { name: 'Delete this pass' }).click()
    await page.getByRole('button', { name: 'Yes, delete' }).click()
    await expect(mainRows(page)).toHaveCount(6)
    await expect(page.locator('li.row-leaving, li.row-entering')).toHaveCount(0)
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 360, height: 740 } })

  test('the row just moves, with no sliding', async ({ page }) => {
    await seedSamples(page)
    await mainRows(page)
      .filter({ hasText: '1 / 1' })
      .getByRole('button', { name: /^Use one entry/ })
      .tap()
    await expect(mainRows(page)).toHaveCount(6)
    await expect(page.locator('li.row-leaving, li.row-entering')).toHaveCount(0)
  })
})
