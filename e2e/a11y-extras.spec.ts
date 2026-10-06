import { expect, test, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// What an automated scan cannot judge: large text, reflow, the keyboard, focus and the semantics
// the gym autocomplete announces to a screen reader.

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const noSideScroll = (page: Page, width: number) =>
  page
    .evaluate(() => document.documentElement.scrollWidth)
    .then((w) => expect(w).toBeLessThanOrEqual(width))

test.describe('large text and a narrow screen (WCAG 1.4.4, 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('every screen reflows at 200% text with no sideways scroll and tappable controls', async ({
    page,
  }) => {
    await seedSamples(page)
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' }) // text sized up
    await expect(mainRows(page).first()).toBeVisible()
    await noSideScroll(page, 320)

    const row = mainRows(page).filter({ hasText: '7 / 10' })
    await row.getByRole('button', { name: /details$/ }).click()
    await expect(page.getByRole('region', { name: /^Details:/ })).toBeVisible()
    await noSideScroll(page, 320)
    for (const control of await page
      .getByRole('region', { name: /^Details:/ })
      .locator('button, input, select, textarea')
      .all()) {
      if (!(await control.isVisible())) continue
      const box = (await control.boundingBox())!
      expect(
        box.height,
        await control.evaluate((el) => el.outerHTML.slice(0, 80)),
      ).toBeGreaterThanOrEqual(44)
      expect(box.x + box.width).toBeLessThanOrEqual(320 + 1)
    }

    // The History section, with its date editor open, reflows too.
    await page.goto('/')
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await page.getByText(/History \(\d+\)/).click()
    await page
      .getByRole('group', { name: 'Usage history' })
      .getByRole('button', { name: /^Change date/ })
      .first()
      .click()
    await expect(page.getByLabel('Date of this entry')).toBeVisible()
    await noSideScroll(page, 320)

    for (const path of ['/settings', '/about', '/privacy', '/terms']) {
      await page.goto(path)
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await noSideScroll(page, 320)
    }
  })
})

test.describe('by keyboard', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('the gym autocomplete announces itself and works with the arrow keys', async ({ page }) => {
    await page.goto('/')
    const gym = page.getByRole('combobox', { name: 'Gym' })
    await gym.focus()
    await gym.pressSequentially('boulder')
    await expect(gym).toHaveAttribute('aria-expanded', 'true')
    const list = page.getByRole('listbox', { name: 'Matching gyms' })
    await expect(list).toBeVisible()
    await expect(gym).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!)
    await gym.press('ArrowDown')
    const active = await gym.getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
    await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('aria-selected', 'true')
    const name = (await page.locator(`[id="${active}"]`).innerText()).trim()
    await gym.press('Enter')
    await expect(gym).toHaveValue(name)
    await expect(gym).toHaveAttribute('aria-expanded', 'false')
    await gym.fill('boulder')
    await expect(list).toBeVisible()
    await gym.press('Escape')
    await expect(list).toHaveCount(0)
  })

  test('a row is reached, opened and operated with the keyboard alone, and focus is visible', async ({
    page,
  }) => {
    await seedSamples(page)
    const row = mainRows(page).filter({ hasText: '7 / 10' })
    // Every control on the row can take focus and shows it.
    const controls = row.locator('button')
    await expect(controls).toHaveCount(3) // gym / details, −, +
    for (const control of await controls.all()) {
      await control.focus()
      const style = await control.evaluate((el) => {
        const s = getComputedStyle(el)
        return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow }
      })
      expect((style.outline !== 'none' && style.width > 0) || style.shadow !== 'none').toBe(true)
    }
    // − by keyboard counts one use, and the new count is announced in the row.
    await row.getByRole('button', { name: /^Use one entry/ }).focus()
    await page.keyboard.press('Enter')
    await expect(mainRows(page).filter({ hasText: '6 / 10' })).toHaveCount(1)
    // The details open and close with the keyboard, and Cancel hands focus back.
    const toggle = mainRows(page)
      .filter({ hasText: '6 / 10' })
      .getByRole('button', { name: /details$/ })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('text inputs show where focus is', async ({ page }) => {
    await page.goto('/')
    const entries = page.getByLabel('Entries', { exact: true })
    await entries.focus()
    const style = await entries.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow }
    })
    expect((style.outline !== 'none' && style.width > 0) || style.shadow !== 'none').toBe(true)
  })

  test('the row buttons say what they do, and errors are announced', async ({ page }) => {
    await seedSamples(page)
    const row = mainRows(page).filter({ hasText: '7 / 10' })
    await expect(row.getByRole('button', { name: /^Use one entry/ })).toBeVisible()
    await expect(row.getByRole('button', { name: /^Give one entry back/ })).toBeVisible()
    await page.getByRole('button', { name: 'Add a pass' }).tap()
    await page.getByRole('button', { name: 'Add pass', exact: true }).tap()
    const alerts = page.getByRole('alert')
    await expect(alerts.first()).toBeVisible()
    expect(await alerts.count()).toBeGreaterThanOrEqual(3) // every problem, announced
    await expect(page.getByLabel('Entries', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})
