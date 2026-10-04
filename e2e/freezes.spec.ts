import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// Freezes for a membership (FR-20): on a phone, from the details panel.
test.use({ viewport: { width: 360, height: 740 } })

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const panel = (page: Page) => page.getByRole('region', { name: /^Details:/ })

/** `YYYY-MM-DD` for today plus some days, in the browser's (and this process's) time zone. */
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function openMembership(page: Page) {
  await seedSamples(page)
  const row = mainRows(page).filter({ hasText: 'Unlimited' }) // the unlimited membership
  await row.getByRole('button', { name: /details$/ }).click()
  await expect(panel(page)).toBeVisible()
  return row
}

test('freezing a membership moves its end date back and marks it Frozen; removing undoes it', async ({
  page,
}) => {
  const row = await openMembership(page)
  const before = await row.innerText()
  await expect(row).not.toContainText('Frozen')

  await panel(page).getByRole('button', { name: 'Add a freeze' }).click()
  const group = panel(page).getByRole('group', { name: 'Add a freeze' })
  await group.getByLabel('End').fill(inDays(13)) // today to today + 13: 14 days
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  for (const control of await group.locator('input, button').all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await group.getByRole('button', { name: 'Add freeze' }).click()

  await expect(row).toContainText('Frozen')
  await expect(panel(page).getByRole('listitem', { name: 'Freeze 1' })).toContainText('14 days')
  expect(await row.innerText()).not.toBe(before) // the end date moved

  await page.reload() // it is kept
  await mainRows(page)
    .filter({ hasText: 'Unlimited' })
    .getByRole('button', { name: /details$/ })
    .click()
  await expect(panel(page).getByRole('listitem', { name: 'Freeze 1' })).toBeVisible()
  await expect(mainRows(page).filter({ hasText: 'Unlimited' })).toContainText('Frozen')

  await panel(page).getByRole('button', { name: 'Remove freeze 1' }).click()
  await panel(page).getByRole('button', { name: 'Yes, delete' }).click()
  await expect(panel(page).getByRole('listitem', { name: 'Freeze 1' })).toHaveCount(0)
  await expect(mainRows(page).filter({ hasText: 'Unlimited' })).not.toContainText('Frozen')
})

test('a freeze with its end before its start says so and is not added', async ({ page }) => {
  await openMembership(page)
  await panel(page).getByRole('button', { name: 'Add a freeze' }).click()
  const group = panel(page).getByRole('group', { name: 'Add a freeze' })
  await group.getByLabel('Start').fill(inDays(10))
  await group.getByLabel('End').fill(inDays(3))
  await group.getByRole('button', { name: 'Add freeze' }).click()
  await expect(group.getByText('End date cannot be before the start date')).toBeVisible()
  await expect(panel(page).getByRole('listitem', { name: 'Freeze 1' })).toHaveCount(0)
})

test('a multipass has no freezes', async ({ page }) => {
  await seedSamples(page)
  await mainRows(page)
    .filter({ hasText: '7 / 10' })
    .getByRole('button', { name: /details$/ })
    .click()
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Add a freeze' })).toHaveCount(0)
})

test('freezes work with no network', async ({ page, context }) => {
  await seedSamples(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  const row = mainRows(page).filter({ hasText: 'Unlimited' })
  await row.getByRole('button', { name: /details$/ }).click()
  await panel(page).getByRole('button', { name: 'Add a freeze' }).click()
  const group = panel(page).getByRole('group', { name: 'Add a freeze' })
  await group.getByLabel('End').fill(inDays(6))
  await group.getByRole('button', { name: 'Add freeze' }).click()
  await expect(row).toContainText('Frozen')
})
