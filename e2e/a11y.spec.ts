import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// Automated accessibility scan (WCAG 2.1 A and AA) of every screen and state, in light and dark.
// A serious or critical finding fails the test; anything milder is printed so it is not lost.
test.use({ viewport: { width: 360, height: 740 } })

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const toggle = (row: ReturnType<typeof mainRows>) => row.getByRole('button', { name: /details$/ })

async function scan(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const describe = (v: (typeof violations)[number]) =>
    `${v.impact}: ${v.id} (${v.help}) on ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ')}`
  const worst = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const milder = violations.filter((v) => !worst.includes(v))
  if (milder.length) console.log(`a11y (milder) ${where}:\n  ${milder.map(describe).join('\n  ')}`)
  expect(worst.map(describe), `accessibility problems: ${where}`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
    })

    test('the empty main screen, with its install card', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('combobox', { name: 'Gym' }).waitFor()
      await scan(page, 'empty main screen')
      await page.getByRole('button', { name: 'Add pass', exact: true }).tap() // errors on screen
      await expect(page.getByText('Enter a gym name')).toBeVisible()
      await scan(page, 'new row with every error showing')
      await page.getByRole('combobox', { name: 'Gym' }).fill('bou')
      await expect(page.getByRole('listbox')).toBeVisible()
      await scan(page, 'gym autocomplete open')
    })

    test('the main screen with every kind of row, banners and Finished', async ({ page }) => {
      await seedSamples(page)
      await expect(mainRows(page)).toHaveCount(7)
      await scan(page, 'main screen with rows and banners')
      await page.getByText('Finished (2)').tap()
      await scan(page, 'Finished section open')
      await page.getByRole('button', { name: 'Add a pass' }).tap()
      await scan(page, 'new row opened by its button')
    })

    test('the details panel of a multipass, a membership with freezes, and a monthly one', async ({
      page,
    }) => {
      await seedSamples(page)
      await toggle(mainRows(page).filter({ hasText: '7 / 10' })).click()
      await scan(page, 'details panel (multipass)')
      await page.getByRole('button', { name: 'Cancel changes' }).tap()

      await toggle(mainRows(page).filter({ hasText: 'Unlimited' })).click()
      await page.getByRole('button', { name: 'Add a freeze' }).tap()
      await scan(page, 'details panel (membership) with the add-a-freeze form')
      await page.getByLabel('End').fill('2099-01-01')
      await page.getByRole('button', { name: 'Add freeze' }).tap()
      await expect(page.getByRole('list', { name: 'Freezes' })).toBeVisible()
      await scan(page, 'details panel (membership) with a freeze listed')
      await page.getByRole('button', { name: 'Cancel changes' }).tap()

      await toggle(mainRows(page).filter({ hasText: 'resets' })).click()
      await scan(page, 'details panel (monthly membership)')
    })

    test('the History section, closed, open and with the date editor', async ({ page }) => {
      await seedSamples(page)
      await scan(page, 'main screen with a History section')
      await page.getByText(/History \(\d+\)/).click()
      const history = page.getByRole('list', { name: 'Usage history' })
      await expect(history).toBeVisible()
      await scan(page, 'History open')
      await history
        .getByRole('button', { name: /^Change date/ })
        .first()
        .click()
      await expect(page.getByLabel('Date of this entry')).toBeVisible()
      await scan(page, 'History with the date editor')
      await page.getByLabel('Date of this entry').fill('2099-01-01')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'after today' })).toBeVisible()
      await scan(page, 'History with a refused date')
    })

    test('the notices, and the Buy again row', async ({ page }) => {
      await seedSamples(page)
      await toggle(mainRows(page).filter({ hasText: '7 / 10' })).click()
      await page.getByLabel(/^Comments/).fill('note')
      await page.getByRole('button', { name: 'Save' }).tap()
      await expect(page.getByText('Changes saved')).toBeVisible()
      await scan(page, 'Changes saved notice')
      await toggle(mainRows(page).filter({ hasText: '7 / 10' })).click()
      await page.getByRole('button', { name: 'Buy again' }).tap()
      await expect(page.getByRole('form', { name: 'New pass' })).toBeVisible()
      await scan(page, 'Buy again row')
    })

    test('Settings, About, the privacy policy and the terms', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
      await scan(page, 'Settings')
      await page.goto('/about')
      await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
      await scan(page, 'About')
      await page.goto('/privacy')
      await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
      await scan(page, 'privacy policy')
      await page.goto('/terms')
      await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()
      await scan(page, 'terms of use')
    })
  })
}
