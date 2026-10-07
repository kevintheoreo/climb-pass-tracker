import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockDropbox } from './dropboxMock'
import { seedSamples } from './seed'

// The optional Dropbox backup (FR-78), against a pretend Dropbox. The test build has a made-up app
// key, which is what switches the feature on.
test.use({ viewport: { width: 360, height: 740 } })

const connect = async (page: Page) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Connect Dropbox', exact: true }).click()
  await expect(page.getByText('Dropbox is connected.').first()).toBeVisible()
}

test('connect, back up now, survive a reload, then disconnect', async ({ page }) => {
  const dropbox = await mockDropbox(page)
  await seedSamples(page)
  await connect(page)
  // The sign-in code is gone from the address.
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByText(/No Dropbox backup yet/)).toBeVisible()

  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText('Backed up to Dropbox.')).toBeVisible()
  expect(JSON.parse(dropbox.file!).passes.length).toBeGreaterThan(3)
  expect(dropbox.file).not.toMatch(/refresh|"access"/)

  await page.reload()
  await expect(page.getByText(/Last Dropbox backup: /)).toBeVisible()

  await page.getByRole('button', { name: 'Disconnect Dropbox' }).click()
  await expect(page.getByRole('button', { name: 'Connect Dropbox', exact: true })).toBeVisible()
  // The app forgets the connection first and tells Dropbox right after, so wait for that call.
  await expect.poll(() => dropbox.calls.some((c) => c.endsWith('/auth/token/revoke'))).toBe(true)
  expect(dropbox.file).not.toBeNull()
})

test('the app backs itself up when it is opened, once connected', async ({ page }) => {
  const dropbox = await mockDropbox(page)
  await seedSamples(page)
  await connect(page)
  expect(dropbox.file).toBeNull()
  await page.goto('/')
  await expect.poll(() => dropbox.file !== null).toBe(true)
  await page.goto('/settings')
  await expect(page.getByText(/Last Dropbox backup: /)).toBeVisible()
})

test('a backup from another phone is never replaced unasked, and can be restored', async ({
  page,
}) => {
  // Make a backup file from sample data, then start over as "a new phone" with one pass of its own.
  const maker = await mockDropbox(page)
  await seedSamples(page)
  await connect(page)
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText('Backed up to Dropbox.')).toBeVisible()
  const theirs = maker.file!

  await page.getByRole('button', { name: 'Disconnect Dropbox' }).click()
  await page.evaluate(() => indexedDB.deleteDatabase('climb-pass-tracker'))
  await page.unrouteAll()
  const dropbox = await mockDropbox(page, theirs)
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Gym' }).fill('Solo Wall')
  await page.getByLabel('Entries', { exact: true }).fill('3')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.getByRole('button', { name: 'Add pass', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Solo Wall, Multipass/ })).toBeVisible()

  await connect(page)
  await page.goto('/')
  await expect.poll(() => dropbox.calls.some((c) => c.endsWith('/files/get_metadata'))).toBe(true)
  expect(dropbox.file).toBe(theirs)
  await page.goto('/settings')
  await expect(page.getByText(/already has a backup, probably from another phone/)).toBeVisible()

  // Back up now asks first; Cancel leaves the other phone's backup alone.
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(
    page.getByRole('alertdialog', { name: 'Replace the backup in Dropbox' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  expect(dropbox.file).toBe(theirs)

  await page.getByRole('button', { name: 'Restore from Dropbox' }).click()
  const preview = page.getByRole('region', { name: 'Backup preview' })
  await expect(preview).toBeVisible()
  await preview.getByRole('button', { name: 'Add to this device' }).click()
  await expect(page.getByText('Done. This device now has:')).toBeVisible()
  await expect(page.getByText(/already has a backup/)).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Solo Wall, Multipass/ })).toBeVisible()
  expect(dropbox.file).toBe(theirs)
})

test('an empty phone cannot replace the Dropbox backup, and is pointed to Restore', async ({
  page,
}) => {
  const dropbox = await mockDropbox(page, '{"precious":true}')
  await page.goto('/')
  await expect(page.getByRole('combobox', { name: 'Gym' })).toBeVisible()
  await connect(page)
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText(/nothing on this phone to back up yet/)).toBeVisible()
  await expect(page.getByText(/choose Restore from Dropbox/)).toBeVisible()
  expect(dropbox.file).toBe('{"precious":true}')
  expect(dropbox.calls.some((c) => c.endsWith('/files/upload'))).toBe(false)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the Dropbox section has no accessibility problems (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const dropbox = await mockDropbox(page, '{"from":"somewhere"}')
    await seedSamples(page)
    const scan = async (where: string) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const worst = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(
        worst.map((v) => `${v.id} on ${v.nodes[0]?.target.join(' ')}`),
        `accessibility problems: ${where}`,
      ).toEqual([])
    }
    await page.goto('/settings')
    await scan('Dropbox, not connected')
    await page.getByRole('button', { name: 'Connect Dropbox', exact: true }).click()
    await expect(page.getByText('Dropbox is connected.').first()).toBeVisible()
    await scan('Dropbox, connected')
    // Another phone's backup is already there: the choice card.
    await page.goto('/')
    await expect.poll(() => dropbox.calls.some((c) => c.endsWith('/files/get_metadata'))).toBe(true)
    await page.goto('/settings')
    await expect(page.getByText(/already has a backup/)).toBeVisible()
    await scan('Dropbox, waiting for a choice')
    await page.getByRole('button', { name: 'Back up now' }).click()
    await expect(
      page.getByRole('alertdialog', { name: 'Replace the backup in Dropbox' }),
    ).toBeVisible()
    await scan('Dropbox, asking before replacing')
  })
}

test('the Dropbox section reflows at 200% text on a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await mockDropbox(page)
  await seedSamples(page)
  await connect(page)
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(320 + 1)
  for (const name of ['Back up now', 'Restore from Dropbox', 'Disconnect Dropbox']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320 + 1)
  }
})
