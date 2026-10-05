import { expect, test } from '@playwright/test'

// The back link lives in the header on every screen but the main one (D51).
test.use({ viewport: { width: 360, height: 740 } })

for (const [path, label, to] of [
  ['/settings', 'Passes', '/'],
  ['/about', 'Passes', '/'],
  ['/privacy', 'Settings', '/settings'],
  ['/terms', 'Settings', '/settings'],
] as const) {
  test(`${path} has a back link to ${label} in the header, in place of the app name`, async ({
    page,
  }) => {
    await page.goto(path)
    const header = page.getByRole('banner')
    const back = header.getByRole('link', { name: `Back to ${label}` })
    await expect(back).toBeVisible()
    await expect(back).toHaveText(label)
    await expect(header.getByText('Climb Pass Tracker')).toHaveCount(0)
    // Nothing in the page body repeats it.
    await expect(page.getByRole('main').getByRole('link', { name: /^Back to/ })).toHaveCount(0)

    const box = (await back.boundingBox())!
    const bar = (await header.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x).toBeGreaterThanOrEqual(0) // not cut off at the left edge
    expect(box.y).toBeGreaterThanOrEqual(bar.y)
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + 1)
    // The heading sits right under the header: no empty band between them.
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    expect(heading.y - (bar.y + bar.height)).toBeLessThanOrEqual(32)

    await back.tap()
    await expect(page).toHaveURL(new RegExp(`${to === '/' ? '/$' : to + '$'}`))
  })
}

test('the main screen keeps the app name and has no back link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner').getByText('Climb Pass Tracker')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Back to/ })).toHaveCount(0)
})
