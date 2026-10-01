import { test, expect } from '@playwright/test'

test('app loads and shows the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Climb Pass Tracker' })).toBeVisible()
})
