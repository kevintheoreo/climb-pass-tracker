import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// The reminder to download a backup file (D47).
test.use({ viewport: { width: 360, height: 740 } })

const nudge = (page: Page) => page.getByRole('region', { name: 'Back up your passes' })

/** Writes when the last backup was made straight into the app's database, then reloads. */
async function lastBackupWas(page: Page, daysAgo: number) {
  await page.evaluate(async (days) => {
    const when = new Date(Date.now() - days * 86_400_000).toISOString()
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('climb-pass-tracker')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction('meta', 'readwrite')
        tx.objectStore('meta').put({ key: 'lastBackupAt', value: when })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
    })
  }, daysAgo)
  await page.reload()
}

test('a new phone with passes is not asked yet', async ({ page }) => {
  await seedSamples(page)
  await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
  await expect(nudge(page)).toHaveCount(0)
})

test('after 45 days the reminder asks; downloading a backup ends it, also after a reload', async ({
  page,
}) => {
  await seedSamples(page)
  await lastBackupWas(page, 45)
  await expect(nudge(page)).toBeVisible()
  await expect(nudge(page)).toContainText('Your last backup file was 1 month')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  for (const button of await nudge(page).getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }

  const download = page.waitForEvent('download')
  await nudge(page).getByRole('button', { name: 'Download backup file' }).click()
  expect((await download).suggestedFilename()).toMatch(/^climb-pass-tracker-backup-/)
  await expect(nudge(page)).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
  await expect(nudge(page)).toHaveCount(0)

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText(/^Last backup: /)).toBeVisible()
})

test('Remind me in a week hides it, also after a reload', async ({ page }) => {
  await seedSamples(page)
  await lastBackupWas(page, 45)
  await nudge(page).getByRole('button', { name: 'Remind me in a week' }).click()
  await expect(nudge(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
  await expect(nudge(page)).toHaveCount(0)
})
