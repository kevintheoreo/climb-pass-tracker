import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// An iPhone: Safari clears a website's data after about a week, so the app asks to be added to
// the home screen (D40). The browser is Chromium, told to say it is Safari on an iPhone.
test.use({
  viewport: { width: 360, height: 740 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
})

const prompt = (page: Page) => page.getByRole('region', { name: /designed to be installed/i })

test('an iPhone is asked once, from the start, to add the app to the home screen', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('No passes yet')).toBeVisible()
  await expect(prompt(page)).toBeVisible() // before any pass: nothing saved in the tab yet
  await expect(prompt(page)).toContainText('keep your entries safely')

  await page.getByRole('combobox', { name: 'Gym' }).fill('Fitbloc')
  await page.getByLabel('Entries', { exact: true }).fill('10')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
  await expect(prompt(page)).toBeVisible()
  await expect(prompt(page)).toContainText('Add to Home Screen')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  const dismiss = prompt(page).getByRole('button', { name: 'Not now' })
  expect((await dismiss.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await dismiss.click()
  await expect(prompt(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
  await expect(prompt(page)).toHaveCount(0) // for good
})

test('Settings keeps saying so after the prompt was dismissed, with the steps', async ({
  page,
}) => {
  await seedSamples(page)
  await expect(prompt(page)).toBeVisible()
  await prompt(page).getByRole('button', { name: 'Not now' }).click()

  await page.getByRole('link', { name: 'Settings' }).click()
  const warning = page.getByRole('status').filter({ hasText: 'could be erased by your browser' })
  await expect(warning).toBeVisible()
  await expect(warning).toContainText('Add to Home Screen')
  await expect(warning).toContainText('download a backup file')
})

test.describe('as an installed app', () => {
  test.beforeEach(async ({ page }) => {
    // What Safari sets when the app is opened from the home screen.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    })
  })

  test('there is no prompt and Settings says the data is safe', async ({ page }) => {
    await seedSamples(page)
    await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
    await expect(prompt(page)).toHaveCount(0)

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByText(/Installed as an app/)).toBeVisible()
    await expect(page.getByText('could be erased by your browser')).toHaveCount(0)
  })
})
