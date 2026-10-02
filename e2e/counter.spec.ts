import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

async function addSamples(page: Page) {
  await seedSamples(page)
  await expect(page.getByText('Finished (2)')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Passes' }).locator(':scope > li')).toHaveCount(7)
}

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
/** The class pack: 1 / 4, expiring soon. */
const classPack = (page: Page) => mainRows(page).filter({ hasText: 'Class / course pack' })

test('− and + change the count, and it stays after a reload', async ({ page }) => {
  await addSamples(page)
  const row = mainRows(page).filter({ hasText: '7 / 10' })
  await row.getByRole('button', { name: /^Use one entry/ }).click()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
  await mainRows(page)
    .filter({ hasText: '6 / 10' })
    .getByRole('button', { name: /^Use one entry/ })
    .click()
  await expect(mainRows(page).filter({ hasText: '5 / 10' })).toHaveCount(1)
  await mainRows(page)
    .filter({ hasText: '5 / 10' })
    .getByRole('button', { name: /^Give one entry back/ })
    .click()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)

  await page.reload()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
})

test('using the last entry moves the row to Finished, and + brings it back', async ({ page }) => {
  await addSamples(page)
  await classPack(page)
    .getByRole('button', { name: /^Use one entry/ })
    .click()
  await expect(page.getByText('Finished (3)')).toBeVisible()
  await expect(classPack(page)).toHaveCount(0)

  await page.getByText('Finished (3)').click()
  const finished = page.getByRole('list', { name: 'Finished passes' })
  const used = finished.locator(':scope > li').filter({ hasText: 'Class / course pack' })
  await expect(used.getByRole('button', { name: /^Use one entry/ })).toBeDisabled()
  await used.getByRole('button', { name: /^Give one entry back/ }).click()
  await expect(classPack(page)).toHaveCount(1)
  await expect(page.getByText('Finished (2)')).toBeVisible()
})

test('a monthly membership at 0 stays put and shows when it resets', async ({ page }) => {
  await addSamples(page)
  const monthly = mainRows(page).filter({ hasText: '3 / 8' })
  for (let left = 3; left > 0; left--) {
    await mainRows(page)
      .filter({ hasText: `${left} / 8` })
      .getByRole('button', { name: /^Use one entry/ })
      .click()
  }
  const empty = mainRows(page).filter({ hasText: '0 / 8' })
  await expect(empty).toHaveCount(1)
  await expect(empty.getByRole('button', { name: /^Use one entry/ })).toBeDisabled()
  await expect(empty).toContainText('resets')
  await expect(monthly).toHaveCount(0)
})

test('counting works with no network', async ({ page, context }) => {
  await addSamples(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await mainRows(page)
    .filter({ hasText: '7 / 10' })
    .getByRole('button', { name: /^Use one entry/ })
    .click()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
  await page.reload()
  await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
})

test('the buttons are at least 44px and nothing overflows on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await addSamples(page)
  const buttons = mainRows(page).getByRole('button')
  expect(await buttons.count()).toBeGreaterThan(6)
  for (const button of await buttons.all()) {
    const box = (await button.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width).toBeLessThanOrEqual(360)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  for (const row of await mainRows(page).all()) {
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false)
  }
})

test('on a wide screen the counter sits in the Left column', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await addSamples(page)
  const row = mainRows(page).first()
  const left = (await page.getByText('Left', { exact: true }).first().boundingBox())!
  const minus = (await row.getByRole('button', { name: /^Use one entry/ }).boundingBox())!
  expect(minus.x).toBeGreaterThanOrEqual(left.x - 4)
  expect(minus.x + 140).toBeLessThanOrEqual(1000)
})
