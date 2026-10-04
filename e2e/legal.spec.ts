import { test, expect } from '@playwright/test'

// Privacy policy and terms (FR-48): reached from Settings on a phone, and available offline.
test.use({ viewport: { width: 360, height: 740 } })

test('Settings links to the privacy policy and terms, which fit a phone', async ({ page }) => {
  await page.goto('/settings')
  const link = page.getByRole('link', { name: 'Privacy policy' })
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await link.tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.getByRole('link', { name: '‹ Settings' }).tap()
  await page.getByRole('link', { name: 'Terms of use' }).tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('the policy pages open with no network', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
  await page.goto('/terms')
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()
})
