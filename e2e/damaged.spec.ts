import { test, expect, type Page } from '@playwright/test'
import { seedSamples } from './seed'

// Whatever is stored for the settings, the main screen and the Settings screen still open.
async function storeSettingsRow(page: Page, row: Record<string, unknown>) {
  await page.evaluate(async (stored) => {
    const open = indexedDB.open('climb-pass-tracker')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('settings', 'readwrite')
    tx.objectStore('settings').put({ id: 'settings', updatedAt: 'x', ...stored })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, row)
}

for (const [name, row] of [
  ['dismissals stored as a list', { dismissedReminders: [] }],
  ['days stored as text', { expiryReminderDays: 'soon' }],
  ['switches stored as numbers', { lowRemindersEnabled: 0, resetRemindersEnabled: 1 }],
] as const) {
  test(`damaged settings (${name}) do not empty the app`, async ({ page }) => {
    await seedSamples(page)
    await storeSettingsRow(page, row)
    await page.reload()
    await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a pass' })).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
    const few = page.getByRole('checkbox', { name: /Few entries left/ })
    await few.click()
    await page.getByRole('link', { name: /Passes/ }).click()
    await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
    await page.getByRole('link', { name: 'Settings' }).click()
    await few.click()
    await page.getByRole('link', { name: /Passes/ }).click()
    await expect(page.getByRole('list', { name: 'Passes' })).toBeVisible()
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
  })
}
