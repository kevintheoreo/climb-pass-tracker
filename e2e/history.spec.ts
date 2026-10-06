import { expect, test, type Page } from '@playwright/test'
import { addDays, formatWeekdayDayMonth, todayLocal } from '../src/domain/dates'
import { seedSamples } from './seed'

// The usage history (D58): every recorded use, with its date, and a way to change the date.
test.use({ viewport: { width: 360, height: 740 } })

const history = (page: Page) => page.getByRole('group', { name: 'Usage history' })
const lines = (page: Page) => history(page).getByRole('listitem')
// Relative to today, so the test does not age (the sample data is dated from today too).
const day = (offset: number) => addDays(todayLocal(), offset)
const openHistory = async (page: Page) => {
  await page.getByText(/History \(\d+\)/).click()
  await expect(history(page)).toBeVisible()
}
const mainRows = (page: Page) =>
  page.getByRole('list', { name: 'Passes', exact: true }).locator(':scope > li')

test('lists the uses, and a new tap on − appears at the top', async ({ page }) => {
  await seedSamples(page)
  await expect(page.getByText('History (5)')).toBeVisible()
  await openHistory(page)
  await expect(lines(page)).toHaveCount(5)
  await expect(lines(page).first()).toContainText('Zig Zag Wall · Membership')

  await mainRows(page)
    .filter({ hasText: '7 / 10' })
    .getByRole('button', { name: /^Use one entry/ })
    .click()
  await expect(page.getByText('History (6)')).toBeVisible()
  await expect(lines(page).first()).toContainText('Multipass')
})

test('a changed date is saved by Save, moves the line, says so and survives a reload', async ({
  page,
}) => {
  await seedSamples(page)
  await openHistory(page)
  const first = lines(page).first()
  const before = await first.locator('p').first().innerText()

  await first.getByRole('button', { name: /^Change date/ }).click()
  const box = page.getByLabel('Date of this entry')
  await expect(box).toBeFocused()
  await box.fill(day(-10))
  // Not saved until Save is pressed: Cancel drops it.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(lines(page).first().locator('p').first()).toHaveText(before)

  await lines(page)
    .first()
    .getByRole('button', { name: /^Change date/ })
    .click()
  await page.getByLabel('Date of this entry').fill(day(-10))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Changes saved')).toBeVisible()
  await expect(page.getByLabel('Date of this entry')).toHaveCount(0)
  // The changed use is now the oldest, so it is the last line.
  await expect(lines(page).last().locator('p').first()).toHaveText(formatWeekdayDayMonth(day(-10)))

  await page.reload()
  await openHistory(page)
  await expect(lines(page).last().locator('p').first()).toHaveText(formatWeekdayDayMonth(day(-10)))
})

test('a date that is not allowed is refused with the reason, and nothing changes', async ({
  page,
}) => {
  await seedSamples(page)
  await openHistory(page)
  await lines(page)
    .first()
    .getByRole('button', { name: /^Change date/ })
    .click()
  await page.getByLabel('Date of this entry').fill('2099-01-01')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'cannot be after today' })).toBeVisible()
  await page.getByLabel('Date of this entry').fill('2000-01-01')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'was bought on' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Date of this entry')).toHaveCount(0)
  await expect(page.getByText('Changes saved')).toHaveCount(0)
})

test('the History section works with no network', async ({ page, context }) => {
  await seedSamples(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The service worker must control the page before it can serve it offline.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await openHistory(page)
  await expect(lines(page)).toHaveCount(5)
})
