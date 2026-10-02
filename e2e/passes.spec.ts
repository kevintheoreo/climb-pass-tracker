import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

async function addSamples(page: Page) {
  await seedSamples(page)
  await expect(page.getByText('Finished (2)')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Passes' }).locator(':scope > li')).toHaveCount(7)
}

test('sample passes show as rows, soonest expiry first, with Finished collapsed', async ({
  page,
}) => {
  await addSamples(page)
  const rows = page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
  const text = await rows.allTextContents()
  expect(text.join(' | ')).toMatch(/Unlimited/)
  expect(text.join(' | ')).toMatch(/3 \/ 8.*resets/)
  expect(text.join(' | ')).toMatch(/No expiry/)

  const finished = page.getByRole('list', { name: 'Finished passes' })
  await expect(finished).toBeHidden()
  await page.getByText('Finished (2)').click()
  await expect(finished).toBeVisible()
  await expect(finished).toContainText('Used up')
  await expect(finished).toContainText('Expired – 6 unused')
})

test('rows survive a reload and show with no network', async ({ page, context }) => {
  await addSamples(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Passes' }).locator(':scope > li')).toHaveCount(7)
})

test('on a phone nothing overflows or is cut off', async ({ page }) => {
  await addSamples(page)
  const viewport = page.viewportSize()!
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport.width,
  )
  for (const row of await page.getByRole('list', { name: 'Passes' }).locator(':scope > li').all()) {
    const clipped = await row.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped).toBe(false)
  }
  // No bottom bar, so nothing covers the last row.
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('on a wide screen the four columns line up under their headings', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await addSamples(page)
  const row = page.getByRole('list', { name: 'Passes' }).locator(':scope > li').first()
  await expect(page.getByText('Expiry', { exact: true }).first()).toBeVisible()
  const boxes = await Promise.all(
    ['Gym:', 'Type:', 'Expiry:', 'Left:'].map(async (label) => {
      const box = await row.getByText(label).locator('..').boundingBox()
      return box!
    }),
  )
  // Same line, left to right.
  const tops = boxes.map((b) => Math.round(b.y))
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(12)
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x)
})
