import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const banners = (page: Page) => page.getByRole('region', { name: 'Reminders' })

async function seeded(page: Page) {
  await seedSamples(page)
  await expect(page.getByText('Finished (2)')).toBeVisible()
}

test('banners say what needs attention, and the row they are about is highlighted', async ({
  page,
}) => {
  await seeded(page)
  // The class pack: 10 days to go and 1 of 4 left. The 2 / 10 pass is low. The membership with
  // 20 days to go is outside the 14-day window.
  await expect(
    banners(page).getByText(/Class \/ course pack: expires in 10 days, 1 entry left/),
  ).toBeVisible()
  await expect(banners(page).getByText(/Multipass: 2 entries left/)).toBeVisible()
  await expect(banners(page).getByText(/Membership: expires/)).toHaveCount(0)

  await expect(
    mainRows(page).filter({ hasText: 'Class / course pack' }).getByText('Has a reminder.'),
  ).toBeAttached()
  await expect(
    mainRows(page).filter({ hasText: '7 / 10' }).getByText('Has a reminder.'),
  ).toHaveCount(0)
})

test('dismissing a banner hides it, and it stays hidden after a reload', async ({ page }) => {
  await seeded(page)
  const lowBanner = banners(page).getByText(/Multipass: 2 entries left/)
  await expect(lowBanner).toBeVisible()
  await page.getByRole('button', { name: /^Dismiss reminder: .*Multipass: 2 entries left/ }).click()
  await expect(lowBanner).toHaveCount(0)
  await page.reload()
  await expect(mainRows(page).first()).toBeVisible()
  await expect(banners(page).getByText(/Multipass: 2 entries left/)).toHaveCount(0)
  await expect(
    banners(page)
      .getByText(/Class \/ course pack/)
      .first(),
  ).toBeVisible()
})

test('changing the days in Settings changes the banners', async ({ page }) => {
  await seeded(page)
  await expect(banners(page).getByText(/expires in 45 days/)).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings' }).click()
  const days = page.getByLabel('Days before expiry')
  await days.fill('60, 14, 3')
  await days.press('Enter')
  await page.getByRole('link', { name: /Passes/ }).click()
  await expect(banners(page).getByText(/Multipass: expires in 45 days/)).toBeVisible()
})

test('switching a reminder off in Settings removes its banners', async ({ page }) => {
  await seeded(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: /Few entries left/ }).uncheck()
  await page.getByRole('link', { name: /Passes/ }).click()
  await expect(banners(page).getByText(/Multipass: 2 entries left/)).toHaveCount(0)
  await expect(banners(page).getByText(/expires in 10 days/)).toBeVisible()
})

test('deleting all data asks first, then leaves an empty app', async ({ page }) => {
  await seeded(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Delete all data on this device' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Delete all data on this device' }).click()
  await page.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page.getByText('All data on this device was deleted.')).toBeVisible()
  await page.getByRole('link', { name: /Passes/ }).click()
  await expect(page.getByText('No passes yet')).toBeVisible()
  await page.reload()
  await expect(page.getByText('No passes yet')).toBeVisible()
})

test('Settings works with no network', async ({ page, context }) => {
  await seeded(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.goto('/settings')
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  const low = page.getByLabel(/^Remind me at this many entries/)
  await low.fill('4')
  await low.press('Enter')
  await page.getByRole('link', { name: /Passes/ }).click()
  await expect(banners(page).getByText(/Multipass: 2 entries left/)).toBeVisible()
})

test('on a phone Settings and the banners fit, and every control is at least 44px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seeded(page)
  for (const button of await banners(page).getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  const controls = page
    .locator('main')
    .locator('input:not([type=checkbox]):not([type=file]), button')
  for (const control of await controls.all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  for (const checkbox of await page.getByRole('checkbox').all()) {
    const label = checkbox.locator('xpath=ancestor::label')
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await expect(page.getByText(/version \d/)).toBeVisible()
})

test('tapping − down to the low level does not move the list; the banner comes at the next opening', async ({
  page,
}) => {
  await seeded(page)
  const row = mainRows(page).filter({ hasText: '3 / 20' }) // 3 left: not low yet
  const minus = row.getByRole('button', { name: /^Use one entry/ })
  const bannerCount = await banners(page).getByRole('listitem').count()
  // Where the row is on the page, however far the page is scrolled.
  const top = (r: ReturnType<typeof mainRows>) =>
    r.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  const before = await top(row)

  await minus.click() // 2 left: low
  await expect(mainRows(page).filter({ hasText: '2 / 20' })).toHaveCount(1)
  await mainRows(page)
    .filter({ hasText: '2 / 20' })
    .getByRole('button', { name: /^Use one entry/ })
    .click()
  await expect(mainRows(page).filter({ hasText: '1 / 20' })).toHaveCount(1)

  // Nothing was pushed in above the list, so the next tap lands where the last one did.
  await expect(banners(page).getByRole('listitem')).toHaveCount(bannerCount)
  expect(await top(mainRows(page).filter({ hasText: '1 / 20' }))).toBe(before)
  await expect(
    mainRows(page).filter({ hasText: '1 / 20' }).getByText('Low', { exact: true }),
  ).toBeVisible()

  // The next time the app is opened, the banner is there.
  await page.reload()
  await expect(banners(page).getByRole('listitem')).toHaveCount(bannerCount + 1)
})
