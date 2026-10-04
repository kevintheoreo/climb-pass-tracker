import { test, expect, type Page } from '@playwright/test'
import { openAddRow, seedSamples } from './seed'

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const gym = (page: Page) => page.getByRole('combobox', { name: 'Gym' })

async function fillRow(page: Page, gymName: string, entries: string) {
  await gym(page).fill(gymName)
  await page.getByLabel('Entries', { exact: true }).fill(entries)
  await page.getByRole('button', { name: '+6 months' }).click()
}

test('a pass added in the blank row appears, and is still there after a reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('No passes yet')).toBeVisible()
  await fillRow(page, 'Fitbloc', '10')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)
  await expect(mainRows(page).first()).toContainText('Fitbloc')
  await expect(mainRows(page).first()).toContainText('10 / 10')
  // With a pass on the list the blank row is hidden behind a button.
  await expect(gym(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a pass' })).toBeFocused()

  await page.reload()
  await expect(mainRows(page)).toHaveCount(1)
  await openAddRow(page)
  // The new gym is now in the autocomplete.
  await gym(page).fill('fit')
  await expect(page.getByRole('option', { name: 'Fitbloc' })).toBeVisible()
  // Typing the whole name, in any case, is the same gym: nothing offers to add a copy.
  await gym(page).fill('FITBLOC')
  await expect(page.getByRole('option', { name: 'Fitbloc' })).toBeVisible()
  await expect(page.getByRole('option', { name: /as a new gym/ })).toHaveCount(0)
})

test('tapping a suggestion and then tapping away saves the row', async ({ page }) => {
  await page.goto('/')
  await fillRow(page, 'Zig Zag Wall', '5')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)

  await openAddRow(page)
  await gym(page).fill('zig')
  await page.getByRole('option', { name: 'Zig Zag Wall' }).tap()
  await expect(gym(page)).toHaveValue('Zig Zag Wall')
  await page.getByLabel('Entries', { exact: true }).fill('20')
  await page.getByRole('button', { name: '+12 months' }).tap()
  await expect(mainRows(page)).toHaveCount(1) // still inside the row: not saved yet
  await page.getByRole('heading', { name: 'Passes', exact: true }).tap() // tap outside the form
  await expect(mainRows(page)).toHaveCount(2)
})

test('an unfinished row says what is missing and saves nothing', async ({ page }) => {
  await page.goto('/')
  await gym(page).fill('Zig Zag Wall')
  await page.getByRole('heading', { name: 'Add a pass' }).tap()
  await expect(page.getByText('Enter the number of entries')).toBeVisible()
  await expect(page.getByText('Enter an expiry date')).toBeVisible()
  await expect(page.getByText('No passes yet')).toBeVisible()
})

test('adding works with no network', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await fillRow(page, 'Offline Wall', '3')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)
})

test('on a phone the row fits, its controls are big enough and the dropdown is not cut off', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await fillRow(page, 'Zig Zag Wall', '5')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)

  await openAddRow(page)
  await gym(page).fill('z')
  const option = page.getByRole('option').first()
  await expect(option).toBeVisible()
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const viewport = page.viewportSize()!
  const box = (await page.getByRole('listbox').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport.width,
  )

  for (const control of [
    gym(page),
    page.getByLabel('Type'),
    page.getByLabel('Entries', { exact: true }),
    page.getByLabel('Expiry'),
    page.getByRole('button', { name: '+6 months' }),
    page.getByRole('button', { name: '+12 months' }),
  ]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('on a wide screen the blank row lines up under the column headings', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto('/')
  await fillRow(page, 'Zig Zag Wall', '5')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)

  await openAddRow(page)
  const xs = await Promise.all(
    [
      gym(page),
      page.getByLabel('Type'),
      page.getByLabel('Expiry'),
      page.getByLabel('Entries', { exact: true }),
    ].map(async (c) => (await c.boundingBox())!),
  )
  const tops = xs.map((b) => Math.round(b.y))
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(12)
  for (let i = 1; i < xs.length; i++) expect(xs[i]!.x).toBeGreaterThan(xs[i - 1]!.x)
})

test('with passes the blank row is a button; the button opens it and Close hides it again', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seedSamples(page)
  await expect(page.getByRole('heading', { name: 'Add a pass' })).toHaveCount(0)
  await expect(gym(page)).toHaveCount(0)
  const button = page.getByRole('button', { name: 'Add a pass' })
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await button.tap()
  await expect(gym(page)).toBeFocused()
  await expect(button).toHaveCount(0)
  await page.getByRole('button', { name: 'Close' }).tap()
  await expect(gym(page)).toHaveCount(0)
  await expect(button).toBeVisible()
})
