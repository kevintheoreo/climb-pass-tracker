import { test, expect } from '@playwright/test'

test('opens on the main screen; the gear opens Settings and the back link returns', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0) // no tab bar
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
})

test('the gear is at least 44px and the page fits the phone viewport', async ({ page }) => {
  await page.goto('/')
  const viewport = page.viewportSize()!
  const box = (await page.getByRole('link', { name: 'Settings' }).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
})

test('deep links work (SPA fallback)', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
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
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
})

test('the monkey opens About, is a 44px target, and the links go to the developer', async ({
  page,
}) => {
  await page.goto('/')
  const monkey = page.getByRole('link', { name: 'About' })
  const box = (await monkey.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
  const gear = (await page.getByRole('link', { name: 'Settings' }).boundingBox())!
  expect(box.x + box.width).toBeLessThanOrEqual(gear.x) // the two targets do not overlap
  await monkey.click()
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  await expect(page.getByRole('link', { name: /@crampingapey/ })).toHaveAttribute(
    'href',
    'https://www.instagram.com/crampingapey',
  )
  await expect(page.getByRole('link', { name: /What type of climber are you/ })).toHaveAttribute(
    'href',
    'https://climbertype.vercel.app/',
  )
  // The quiz logo is a file of the app itself (the strict policy allows no outside images).
  await expect
    .poll(() =>
      page
        .locator('img[src="/climbertype.png"]')
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0)
  await expect(page.getByRole('link', { name: /Buy me a coffee/ })).toHaveAttribute(
    'href',
    'https://buymeacoffee.com/Crampingapey',
  )
  await page.getByRole('link', { name: 'Back to Passes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
})
