import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'
import { todayLocal } from '../src/domain/dates'
import { relativeTime } from '../src/domain/format'

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const panel = (page: Page) => page.getByRole('region', { name: /^Details:/ })
const toggle = (row: ReturnType<typeof mainRows>) => row.getByRole('button', { name: /details$/ })

async function seeded(page: Page) {
  await seedSamples(page)
  await expect(page.getByText('Finished (2)')).toBeVisible()
  await expect(mainRows(page)).toHaveCount(7)
}

test('editing an expiry in the details panel saves by itself and survives a reload', async ({
  page,
}) => {
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  const seededExpiry = relativeTime(120, todayLocal()) // the expiry as seeded, in months
  await expect(row).toContainText(seededExpiry)
  await toggle(row).click()
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: '+12 months' }).click()
  await panel(page)
    .getByLabel(/^Comments/)
    .fill('bought at the sale')
  await page.getByRole('heading', { name: 'Passes', exact: true }).tap() // tap away
  // The save runs in the background: wait until the row shows the new expiry. (Not by comparing
  // the whole row's text: opening the panel already changes that.)
  await expect(mainRows(page).filter({ hasText: '7 / 10' })).not.toContainText(seededExpiry)

  await page.reload()
  const again = mainRows(page).filter({ hasText: '7 / 10' })
  await toggle(again).click()
  await expect(panel(page).getByLabel(/^Comments/)).toHaveValue('bought at the sale')
})

test('tapping the row opens its details; tapping − does not', async ({ page }) => {
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await row.getByRole('button', { name: /^Use one entry/ }).tap()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
  await expect(panel(page)).toHaveCount(0)
  await mainRows(page).filter({ hasText: '6 / 10' }).getByText('Multipass').first().tap()
  await expect(panel(page)).toBeVisible()
})

test('an unfinished edit says what is wrong and is not saved', async ({ page }) => {
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await toggle(row).click()
  await panel(page).getByLabel('Entries', { exact: true }).fill('0')
  await panel(page).getByLabel('Already used').fill('x')
  await page.getByRole('heading', { name: 'Passes', exact: true }).tap()
  await expect(panel(page).getByText('Entries must be at least 1')).toBeVisible()
  await expect(panel(page).getByText('Enter a whole number')).toBeVisible()
  await panel(page).getByRole('button', { name: 'Done' }).click()
  await expect(mainRows(page).filter({ hasText: '7 / 10' })).toHaveCount(1)
})

test('deleting asks first and then removes the row', async ({ page }) => {
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '1 / 1' })
  await toggle(row).click()
  await panel(page).getByRole('button', { name: 'Delete this pass' }).click()
  await panel(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(mainRows(page)).toHaveCount(7)
  await panel(page).getByRole('button', { name: 'Delete this pass' }).click()
  await panel(page).getByRole('button', { name: 'Yes, delete' }).click()
  await expect(mainRows(page)).toHaveCount(6)
  await page.reload()
  await expect(mainRows(page)).toHaveCount(6)
})

test('using the last entry shows a Moved to Finished notice, and Undo brings the row back', async ({
  page,
}) => {
  await seeded(page)
  const pack = mainRows(page).filter({ hasText: 'Class / course pack' })
  await pack.getByRole('button', { name: /^Use one entry/ }).click()
  const notice = page.getByRole('status').filter({ hasText: 'moved to Finished' })
  await expect(notice).toBeVisible()
  await expect(page.getByText('Finished (3)')).toBeVisible()
  await notice.getByRole('button', { name: 'Undo' }).click()
  await expect(notice).toHaveCount(0)
  await expect(mainRows(page).filter({ hasText: 'Class / course pack' })).toHaveCount(1)
  await expect(page.getByText('Finished (2)')).toBeVisible()
})

test('the notice does not cover the last row: it can be scrolled above it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seeded(page)
  const pack = mainRows(page).filter({ hasText: 'Class / course pack' })
  await pack.getByRole('button', { name: /^Use one entry/ }).click()
  const notice = page.getByRole('status').filter({ hasText: 'moved to Finished' })
  await expect(notice).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const noticeBox = (await notice.locator('div').first().boundingBox())!
  const summaryBox = (await page.getByText('Finished (3)').boundingBox())!
  expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(noticeBox.y)
})

test('editing works with no network', async ({ page, context }) => {
  await seeded(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await toggle(row).click()
  await panel(page)
    .getByLabel(/^Comments/)
    .fill('offline note')
  await page.getByRole('heading', { name: 'Passes', exact: true }).tap()
  await toggle(mainRows(page).filter({ hasText: '7 / 10' })).click() // close, then reopen to check
  await toggle(mainRows(page).filter({ hasText: '7 / 10' })).click()
  await expect(panel(page).getByLabel(/^Comments/)).toHaveValue('offline note')
})

test('on a phone the panel fits and its controls are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seeded(page)
  const row = mainRows(page).filter({ hasText: 'resets' }) // the monthly membership: the most fields
  await toggle(row).click()
  const box = (await panel(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(360)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  for (const control of await panel(page).locator('input:not([disabled]), select, button').all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await expect(panel(page).getByLabel('Already used this month')).toBeVisible()
  await expect(panel(page).getByLabel(/^Reset day/)).toBeVisible()
})

test('on a wide screen the panel spans the row', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await toggle(row).click()
  const rowBox = (await row.boundingBox())!
  const panelBox = (await panel(page).boundingBox())!
  expect(panelBox.x).toBeGreaterThanOrEqual(rowBox.x)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width)
  expect(panelBox.width).toBeGreaterThan(rowBox.width * 0.8)
})

test.describe('with a mouse', () => {
  test.use({ isMobile: false, hasTouch: false })

  test('the notice still goes away when the pointer is resting on it', async ({ page }) => {
    // A short window puts the notice right where the pointer was when `−` was clicked.
    await page.setViewportSize({ width: 1000, height: 255 })
    await seeded(page)
    const pack = mainRows(page).filter({ hasText: 'Class / course pack' })
    await pack.getByRole('button', { name: /^Use one entry/ }).evaluate((el) => {
      el.scrollIntoView({ block: 'end' })
    })
    await pack.getByRole('button', { name: /^Use one entry/ }).click()
    const notice = page.getByRole('status').filter({ hasText: 'moved to Finished' })
    await expect(notice).toBeVisible()
    const box = (await notice.locator('div').first().boundingBox())!
    await page.mouse.move(box.x + 40, box.y + box.height / 2)
    await page.mouse.move(box.x + 44, box.y + box.height / 2)
    // Make sure the pointer really is over it, so this test would catch a hover hold.
    await expect
      .poll(() =>
        notice
          .locator('div')
          .first()
          .evaluate((el) => el.matches(':hover')),
      )
      .toBe(true)
    await expect(notice).toHaveCount(0, { timeout: 12_000 })
  })
})

test('a price paid shows what one entry cost, on the row, and fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await expect(row).not.toContainText('each')
  await toggle(row).click()
  await panel(page)
    .getByLabel(/^Price paid/)
    .fill('120')
  await page.getByRole('heading', { name: 'Passes', exact: true }).tap() // tap away
  await expect(mainRows(page).filter({ hasText: '7 / 10' })).toContainText('S$12.00 each')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

  await page.reload() // it is kept
  await expect(mainRows(page).filter({ hasText: '7 / 10' })).toContainText('S$12.00 each')
})
