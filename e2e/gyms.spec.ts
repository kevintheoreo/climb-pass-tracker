import { test, expect } from '@playwright/test'

test('add your own gym and a pass option; both survive a reload', async ({ page }) => {
  await page.goto('/gyms')
  await expect(page.getByRole('link', { name: /Sample Boulder Gym/ })).toBeVisible()

  // Search finds nothing, so offer to add the typed name as a new gym.
  await page.getByLabel('Search gyms').fill('Zig Zag Wall')
  await page.getByRole('link', { name: 'Add “Zig Zag Wall” as your own gym' }).click()
  await expect(page.getByLabel('Gym name')).toHaveValue('Zig Zag Wall')
  await page.getByLabel('Website (optional)').fill('zigzag.example.com')
  await page.getByRole('button', { name: 'Add gym' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Zig Zag Wall' })).toBeVisible()

  await page.getByRole('link', { name: 'Add a pass option' }).click()
  await page.getByLabel('Name').fill('10-Pass')
  await page.getByLabel('Number of entries').fill('10')
  await page.getByLabel(/Price in S\$/).fill('120')
  await page.getByLabel(/Valid for/).fill('6')
  await page.getByRole('button', { name: 'Add pass option' }).click()
  await expect(page.getByText('Multipass · 10 entries · 6 months · S$120.00')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Zig Zag Wall' })).toBeVisible()
  await expect(page.getByText('Multipass · 10 entries · 6 months · S$120.00')).toBeVisible()
  await expect(page.getByRole('link', { name: 'zigzag.example.com' })).toHaveAttribute(
    'href',
    'https://zigzag.example.com',
  )

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Gyms' }).click()
  await expect(page.getByRole('link', { name: /Zig Zag Wall/ })).toContainText('Added by you')
})

test('adding a gym works with no network', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/gyms/new')
  await page.getByLabel('Gym name').fill('Offline Wall')
  await page.getByRole('button', { name: 'Add gym' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Offline Wall' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Offline Wall' })).toBeVisible()
})

test('form controls are big enough to tap and fit the screen', async ({ page }) => {
  await page.goto('/gyms/new')
  const viewport = page.viewportSize()!
  const controls = page.locator('form input, form button, form a, form select')
  expect(await controls.count()).toBeGreaterThan(0)
  for (const control of await controls.all()) {
    const box = (await control.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
})
