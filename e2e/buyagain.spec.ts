import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// Buy again (FR-21): from a row's details, on a phone.
test.use({ viewport: { width: 360, height: 740 } })

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')

function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test('buying a pass again fills in a new row; the expiry is the only thing left to enter', async ({
  page,
}) => {
  await seedSamples(page)
  await expect(mainRows(page).first()).toBeVisible()
  const before = await mainRows(page).count()
  const row = mainRows(page).filter({ hasText: 'Multipass' }).first()
  await row.getByRole('button', { name: /details$/ }).click()
  await page.getByRole('button', { name: 'Buy again' }).click()

  const form = page.getByRole('form', { name: 'New pass' })
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Expiry')).toHaveValue('')
  expect(await form.getByLabel('Entries').inputValue()).not.toBe('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

  await form.getByLabel('Expiry').fill(inDays(120))
  await form.getByLabel('Expiry').press('Enter')
  await expect(mainRows(page)).toHaveCount(before + 1)
  await expect(page.getByRole('status').filter({ hasText: 'added' })).toBeVisible()
})
