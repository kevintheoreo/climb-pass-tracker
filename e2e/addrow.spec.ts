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
  await fillRow(page, 'Practice Wall', '10')
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)
  await expect(mainRows(page).first()).toContainText('Practice Wall')
  await expect(mainRows(page).first()).toContainText('10 / 10')
  // With a pass on the list the blank row is hidden behind a button.
  await expect(gym(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a pass' })).toBeFocused()

  await page.reload()
  await expect(mainRows(page)).toHaveCount(1)
  await openAddRow(page)
  // The new gym is now in the autocomplete.
  await gym(page).fill('prac')
  await expect(page.getByRole('option', { name: 'Practice Wall' })).toBeVisible()
  // Typing the whole name, in any case, is the same gym: nothing offers to add a copy.
  await gym(page).fill('PRACTICE WALL')
  await expect(page.getByRole('option', { name: 'Practice Wall' })).toBeVisible()
  await expect(page.getByRole('option', { name: /as a new gym/ })).toHaveCount(0)
})

test('tapping a suggestion and then Add pass saves the row; tapping away does not', async ({
  page,
}) => {
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
  await page.waitForTimeout(300)
  await expect(mainRows(page)).toHaveCount(1) // tapping away saves nothing
  await page.getByRole('button', { name: 'Add pass', exact: true }).tap()
  await expect(mainRows(page)).toHaveCount(2)
})

test('an unfinished row says what is missing and saves nothing', async ({ page }) => {
  await page.goto('/')
  await gym(page).fill('Zig Zag Wall')
  await page.getByRole('button', { name: 'Add pass', exact: true }).tap()
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
    page.getByLabel(/^Price paid/),
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
  await page.getByRole('button', { name: 'Cancel' }).tap()
  await expect(gym(page)).toHaveCount(0)
  await expect(button).toBeVisible()
})

test('passes are listed newest first, whatever their expiry, and stay in that order after a reload', async ({
  page,
}) => {
  await page.goto('/')
  await gym(page).fill('Zig Zag Wall') // added first, expires last
  await page.getByLabel('Entries', { exact: true }).fill('10')
  await page.getByRole('button', { name: '+12 months' }).click()
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)

  await openAddRow(page)
  await fillRow(page, 'Practice Wall', '5') // added second, expires sooner
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(2)
  await expect(mainRows(page).nth(0)).toContainText('Practice Wall')
  await expect(mainRows(page).nth(1)).toContainText('Zig Zag Wall')

  await page.reload()
  await expect(mainRows(page).nth(0)).toContainText('Practice Wall')
  await expect(mainRows(page).nth(1)).toContainText('Zig Zag Wall')
})

test('the optional price is on the blank row and is saved with the pass', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await gym(page).fill('Zig Zag Wall')
  await page.getByLabel('Entries', { exact: true }).fill('10')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.getByLabel(/^Price paid/).fill('120')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)

  await mainRows(page)
    .first()
    .getByRole('button', { name: /details$/ })
    .click()
  await expect(
    page.getByRole('region', { name: /^Details:/ }).getByLabel(/^Price paid/),
  ).toHaveValue('120')
})

test('adding a pass says so, and shows the new row even when the list is long', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 700 })
  await seedSamples(page)
  await openAddRow(page)
  await gym(page).fill('Brand New Wall')
  await page.getByLabel('Entries', { exact: true }).fill('5')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.keyboard.press('Enter')

  // A notice at the bottom of the screen names the pass...
  const notice = page.getByRole('status').filter({ hasText: 'Brand New Wall, Multipass added' })
  await expect(notice).toBeVisible()
  // ...the new row (first in the list) has been scrolled into view, with no glow...
  const row = mainRows(page).first()
  await expect(row).toContainText('Brand New Wall')
  await expect(row).not.toHaveClass(/ring-amber-400/)
  await expect
    .poll(async () => {
      const box = await row.boundingBox()
      return box !== null && box.y >= 0 && box.y + box.height <= 700
    })
    .toBe(true)
  // ...and the notice goes away by itself.
  await expect(notice).toHaveCount(0, { timeout: 8000 })
})

test('a real gym is found however its name is typed, and no copy of it is made (D22)', async ({
  page,
}) => {
  await page.goto('/')
  for (const typed of ['fitbloc', 'fit bloc', 'FIT·BLOC']) {
    await gym(page).fill(typed)
    await expect(page.getByRole('option', { name: 'fit·bloc', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: /as a new gym/ })).toHaveCount(0)
  }
  await gym(page).fill('Fitbloc')
  await page.getByLabel('Entries', { exact: true }).fill('10')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.keyboard.press('Enter')
  await expect(mainRows(page)).toHaveCount(1)
  await expect(mainRows(page).first()).toContainText('fit·bloc') // the built-in gym's own spelling
  await expect(mainRows(page).first()).not.toContainText('Fitbloc')
})

test('the Add pass button is visible, big enough to tap, and adds the pass', async ({ page }) => {
  await page.goto('/')
  const add = page.getByRole('button', { name: 'Add pass', exact: true })
  await expect(add).toBeVisible()
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await fillRow(page, 'Button Wall', '4')
  await add.tap()
  await expect(mainRows(page)).toHaveCount(1)
})
