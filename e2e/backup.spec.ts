import { readFile } from 'node:fs/promises'
import { test, expect, type Browser, type Page } from '@playwright/test'

// Moving to another device (D37): two separate browser profiles stand for two phones. They share
// nothing, so the only way data gets from one to the other is the backup file.
test.use({ viewport: { width: 360, height: 740 } })

const rows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const row = (page: Page, text: string | RegExp) => rows(page).filter({ hasText: text })
const gymBox = (page: Page) => page.getByRole('combobox', { name: 'Gym' })

async function newPhone(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto('/')
  await expect(gymBox(page)).toBeVisible()
  return { context, page }
}

async function addPass(page: Page, gym: string, entries: string, expiry = '+6') {
  const before = await rows(page).count()
  await gymBox(page).fill(gym)
  await page.getByLabel('Entries', { exact: true }).fill(entries)
  await page.getByRole('button', { name: expiry === '+6' ? '+6 months' : '+12 months' }).click()
  await page.keyboard.press('Enter')
  // The save runs in the background and clears the blank row: wait for the new row before going on.
  await expect(rows(page)).toHaveCount(before + 1)
}

async function downloadBackup(page: Page): Promise<string> {
  await page.getByRole('link', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup file' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^climb-pass-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await page.getByRole('link', { name: /Passes/ }).click()
  return (await file.path())!
}

async function openBackup(
  page: Page,
  path: string | { name: string; mimeType: string; buffer: Buffer },
) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Open a backup file').setInputFiles(path)
}

test('moving to a new phone: the passes, the counts and the gym all arrive', async ({
  browser,
  baseURL,
}) => {
  const oldPhone = await newPhone(browser, baseURL)
  const a = oldPhone.page
  await addPass(a, 'Fitbloc', '10')
  await addPass(a, 'fitbloc', '20', '+12')
  await expect(rows(a)).toHaveCount(2)
  for (const left of ['10 / 10', '9 / 10', '8 / 10']) {
    await row(a, left)
      .getByRole('button', { name: /^Use one entry/ })
      .click()
  }
  await expect(row(a, '7 / 10')).toHaveCount(1)
  const backupPath = await downloadBackup(a)

  const text = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(text.format).toBe('climb-pass-tracker-backup')
  expect(text.passes).toHaveLength(2)
  expect(text.uses).toHaveLength(3)
  expect(text.userGyms).toHaveLength(1)

  const newPhoneDevice = await newPhone(browser, baseURL)
  const b = newPhoneDevice.page
  await expect(rows(b)).toHaveCount(0) // nothing leaked across: the profiles are separate
  await openBackup(b, backupPath)

  const preview = b.getByRole('region', { name: 'Backup preview' })
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('2 new passes')
  await expect(preview).toContainText('3 recorded uses added')
  await expect(preview).toContainText('1 new gym')
  await expect(rows(b)).toHaveCount(0) // nothing is added until it is confirmed
  await preview.getByRole('button', { name: 'Add to this device' }).click()
  await expect(b.getByText(/Done\. This device now has/)).toBeVisible()

  await b.getByRole('link', { name: /Passes/ }).click()
  await expect(rows(b)).toHaveCount(2)
  await expect(row(b, '7 / 10')).toContainText('Fitbloc')
  await expect(row(b, '20 / 20')).toContainText('Fitbloc')
  // The gym came across too: it is in the dropdown, and typing it again does not offer a copy.
  await gymBox(b).fill('FITBLOC')
  await expect(b.getByRole('option', { name: 'Fitbloc' })).toBeVisible()
  await expect(b.getByRole('option', { name: /as a new gym/ })).toHaveCount(0)

  // It is still there after a reload, and counting carries on from 7.
  await b.reload()
  await minusOne(b, '7 / 10')
  await expect(row(b, '6 / 10')).toHaveCount(1)

  await oldPhone.context.close()
  await newPhoneDevice.context.close()
})

async function minusOne(page: Page, from: string) {
  await row(page, from)
    .getByRole('button', { name: /^Use one entry/ })
    .click()
}

test('a device that already has passes keeps them, and importing the same file again adds nothing', async ({
  browser,
  baseURL,
}) => {
  const first = await newPhone(browser, baseURL)
  await addPass(first.page, 'Zig Zag Wall', '5')
  const backupPath = await downloadBackup(first.page)

  const second = await newPhone(browser, baseURL)
  const b = second.page
  await addPass(b, 'Offline Wall', '3')
  await expect(rows(b)).toHaveCount(1)
  await openBackup(b, backupPath)
  await b
    .getByRole('region', { name: 'Backup preview' })
    .getByRole('button', { name: 'Add to this device' })
    .click()
  await expect(b.getByText(/Done\./)).toBeVisible()
  await b.getByRole('link', { name: /Passes/ }).click()
  await expect(rows(b)).toHaveCount(2)
  await expect(row(b, 'Offline Wall')).toHaveCount(1)
  await expect(row(b, 'Zig Zag Wall')).toHaveCount(1)

  await openBackup(b, backupPath)
  const preview = b.getByRole('region', { name: 'Backup preview' })
  await expect(preview).toContainText('already on this device')
  await expect(preview.getByRole('button', { name: 'Add to this device' })).toHaveCount(0)
  await b.getByRole('link', { name: /Passes/ }).click()
  await expect(rows(b)).toHaveCount(2)

  await first.context.close()
  await second.context.close()
})

test('both devices have been used: each backup adds what the other did and no count is lost', async ({
  browser,
  baseURL,
}) => {
  const one = await newPhone(browser, baseURL)
  const two = await newPhone(browser, baseURL)
  await addPass(one.page, 'Fitbloc', '10')
  const toTwo = await downloadBackup(one.page)
  await openBackup(two.page, toTwo)
  await two.page.getByRole('button', { name: 'Add to this device' }).click()
  await expect(two.page.getByText(/Done\./)).toBeVisible()
  await two.page.getByRole('link', { name: /Passes/ }).click()

  // Then each is used on its own: one counts, the other adds a pass and counts too.
  await minusOne(one.page, '10 / 10')
  await addPass(two.page, 'Boulder Planet', '4')
  await minusOne(two.page, '10 / 10')
  await minusOne(two.page, '9 / 10')

  const fromTwo = await downloadBackup(two.page)
  await openBackup(one.page, fromTwo)
  await expect(one.page.getByRole('region', { name: 'Backup preview' })).toContainText('1 new pass')
  await one.page.getByRole('button', { name: 'Add to this device' }).click()
  await expect(one.page.getByText(/Done\./)).toBeVisible()
  await one.page.getByRole('link', { name: /Passes/ }).click()

  await expect(rows(one.page)).toHaveCount(2)
  // The pass counted on both: the uses from both phones are there (1 here, 2 there, none lost).
  await expect(row(one.page, 'Fitbloc')).toContainText('7 / 10')
  await expect(row(one.page, 'Boulder Planet')).toContainText('4 / 4')

  await one.context.close()
  await two.context.close()
})

test('a file that is not a backup is refused and nothing changes', async ({ browser, baseURL }) => {
  const phone = await newPhone(browser, baseURL)
  await addPass(phone.page, 'Fitbloc', '10')
  await expect(rows(phone.page)).toHaveCount(1)
  for (const file of [
    { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('hello') },
    { name: 'list.json', mimeType: 'application/json', buffer: Buffer.from('[1,2,3]') },
    {
      name: 'newer.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'climb-pass-tracker-backup', version: 99 })),
    },
  ]) {
    await openBackup(phone.page, file)
    await expect(phone.page.getByRole('alert')).toContainText('Nothing was imported')
    await expect(phone.page.getByRole('region', { name: 'Backup preview' })).toHaveCount(0)
    await phone.page.getByRole('link', { name: /Passes/ }).click()
    await expect(rows(phone.page)).toHaveCount(1)
  }
  await phone.context.close()
})

test('opening a backup works with no network', async ({ browser, baseURL }) => {
  const oldPhone = await newPhone(browser, baseURL)
  await addPass(oldPhone.page, 'Fitbloc', '10')
  const backupPath = await downloadBackup(oldPhone.page)

  const phone = await newPhone(browser, baseURL)
  await phone.page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await phone.page.reload()
  await expect
    .poll(() => phone.page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)
  await phone.context.setOffline(true)
  await openBackup(phone.page, backupPath)
  await phone.page.getByRole('button', { name: 'Add to this device' }).click()
  await expect(phone.page.getByText(/Done\./)).toBeVisible()
  await phone.page.getByRole('link', { name: /Passes/ }).click()
  await expect(rows(phone.page)).toHaveCount(1)
  await oldPhone.context.close()
  await phone.context.close()
})

test('on a phone the backup controls and the preview fit and are big enough to tap', async ({
  browser,
  baseURL,
}) => {
  const oldPhone = await newPhone(browser, baseURL)
  await addPass(oldPhone.page, 'Fitbloc', '10')
  const backupPath = await downloadBackup(oldPhone.page)
  const phone = await newPhone(browser, baseURL)
  const page = phone.page
  await openBackup(page, backupPath)
  await expect(page.getByRole('region', { name: 'Backup preview' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  // (Not the file input itself: it is hidden, and the label next to it is the tap target.)
  for (const button of await page.locator('main button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  const open = page.getByText('Open a backup file')
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await oldPhone.context.close()
  await phone.context.close()
})
