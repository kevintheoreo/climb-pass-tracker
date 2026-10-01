import { test, expect } from '@playwright/test'

test('opens on Passes and moves between tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav).toBeVisible()
  for (const name of ['History', 'Gyms', 'Settings']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }
})

test('tab bar targets are at least 44px and stay inside the phone viewport', async ({ page }) => {
  await page.goto('/')
  const viewport = page.viewportSize()!
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all()) {
    const box = (await link.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
})

test('deep links work (SPA fallback)', async ({ page }) => {
  await page.goto('/gyms')
  await expect(page.getByRole('heading', { level: 1, name: 'Gyms' })).toBeVisible()
})

test('follows the system dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await page.emulateMedia({ colorScheme: 'light' })
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(dark).not.toBe(light)
})

test('serves a valid web app manifest with loadable icons', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({
    name: 'Climb Pass Tracker',
    display: 'standalone',
    start_url: '/',
    lang: 'en',
  })
  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any')
  expect(purposes).toContain('maskable')
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`)
    expect(res.ok()).toBe(true)
    expect(res.headers()['content-type']).toContain('image/png')
  }
})

test('works offline after the first visit, including deep links', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The service worker must control the page before it can serve it offline.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
})
