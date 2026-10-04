import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { BUILTIN_GYMS } from '../src/data/gyms'
import { openAddRow } from './seed'

// The core flows of PRD section 8, done the way a person would: on a phone-sized screen, starting
// from an empty app, with nothing put into the database behind the app's back.
test.use({ viewport: { width: 360, height: 740 } })

const mainRows = (page: Page) => page.getByRole('list', { name: 'Passes' }).locator(':scope > li')
const banners = (page: Page) => page.getByRole('region', { name: 'Reminders' })
const gymBox = (page: Page) => page.getByRole('combobox', { name: 'Gym' })
const row = (page: Page, text: string | RegExp) => mainRows(page).filter({ hasText: text })
const minus = (r: ReturnType<typeof row>) => r.getByRole('button', { name: /^Use one entry/ })
const plus = (r: ReturnType<typeof row>) => r.getByRole('button', { name: /^Give one entry back/ })

/** `YYYY-MM-DD` for today plus some days, in the browser's (and this process's) time zone. */
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Fills the blank row and presses Enter. `expiry` is '+6' / '+12' months or a `YYYY-MM-DD` date. */
async function addPass(
  page: Page,
  gym: string,
  { type, entries, expiry = '+6' }: { type?: string; entries?: string; expiry?: string } = {},
) {
  await openAddRow(page)
  await gymBox(page).fill(gym)
  if (type) await page.getByLabel('Type').selectOption({ label: type })
  if (entries !== undefined) await page.getByLabel(/^Entries/).fill(entries)
  if (expiry === '+6') await page.getByRole('button', { name: '+6 months' }).click()
  else if (expiry === '+12') await page.getByRole('button', { name: '+12 months' }).click()
  else if (expiry) await page.getByLabel(/^Expiry/).fill(expiry)
  await page.keyboard.press('Enter')
}

test('first launch: pick a gym from the list, fill the row, and it appears (no sign-up wall)', async ({
  page,
}) => {
  const builtin = BUILTIN_GYMS[0]!.name
  await page.goto('/')
  await expect(page.getByText('No passes yet')).toBeVisible()
  await expect(gymBox(page)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /sign in|log in|sign up/i })).toHaveCount(0)

  await gymBox(page).fill(builtin.slice(0, 8))
  await page.getByRole('option', { name: builtin }).click()
  await expect(gymBox(page)).toHaveValue(builtin)
  await expect(page.getByLabel('Type')).toHaveValue('multipass')
  await page.getByLabel('Entries', { exact: true }).fill('10')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.keyboard.press('Enter')

  await expect(mainRows(page)).toHaveCount(1)
  const created = mainRows(page).first()
  await expect(created).toContainText(builtin)
  await expect(created).toContainText('Multipass')
  await expect(created).toContainText('10 / 10')
  await expect(created).toContainText(/in 18[1-4] days/) // six months from today
  await expect(page.getByRole('button', { name: 'Add a pass' })).toBeVisible()
})

test('an expiry warning names the pass and its row is highlighted', async ({ page }) => {
  await page.goto('/')
  await addPass(page, 'Boulder Planet', { entries: '10', expiry: inDays(14) })
  await expect(mainRows(page)).toHaveCount(1)
  // Use six, leaving four.
  for (let i = 0; i < 6; i++) await minus(mainRows(page)).click()
  await expect(mainRows(page).first()).toContainText('4 / 10')

  await expect(banners(page)).toContainText(
    'Boulder Planet, Multipass: expires in 14 days, 4 entries left',
  )
  await expect(mainRows(page).first().getByText('Has a reminder.')).toBeAttached()
  await banners(page)
    .getByRole('button', { name: /^Dismiss reminder/ })
    .click()
  await expect(banners(page)).toHaveCount(0)
  await expect(mainRows(page).first().getByText('Has a reminder.')).toHaveCount(0)
})

test('a week at the gym: counting, two packs, a membership, Finished, reminders, export, offline', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  // Two packs at one gym, typed as a new gym (flows 4 and 5): two separate rows.
  await addPass(page, 'Fitbloc', { entries: '10', expiry: '+6' })
  await expect(mainRows(page)).toHaveCount(1)
  await addPass(page, 'fitbloc', { entries: '20', expiry: '+12' })
  await expect(mainRows(page)).toHaveCount(2)
  await expect(row(page, '10 / 10')).toHaveCount(1)
  await expect(row(page, '20 / 20')).toHaveCount(1)

  // At the gym with two friends (flows 2 and 3): `−` three times and `+` once.
  for (const before of ['10 / 10', '9 / 10', '8 / 10']) await minus(row(page, before)).click()
  await expect(row(page, '7 / 10')).toHaveCount(1)
  await plus(row(page, '7 / 10')).click()
  await expect(row(page, '8 / 10')).toHaveCount(1)
  await expect(row(page, '20 / 20')).toHaveCount(1) // the other pack is untouched

  // A membership with 8 entries a month (flow 8): counts down, stops at 0, shows its reset date.
  await addPass(page, 'Zig Zag Wall', { type: 'Membership', entries: '8', expiry: '+12' })
  const member = row(page, /8 \/ 8/)
  await expect(member).toHaveCount(1)
  await expect(member).toContainText(/resets \d{1,2} [A-Z][a-z]{2}/)
  for (let left = 8; left > 0; left--) {
    await minus(row(page, new RegExp(`${left} / 8`))).click()
  }
  const empty = row(page, '0 / 8')
  await expect(empty).toHaveCount(1)
  await expect(minus(empty)).toBeDisabled()
  await expect(empty).toContainText(/resets \d{1,2} [A-Z][a-z]{2}/)
  await expect(page.getByText(/Finished \(/)).toHaveCount(0) // a monthly membership stays in the list

  // A single entry runs out (flow 7): the row moves to Finished, with a way back.
  await addPass(page, 'Climb Central', { type: 'Single entry', expiry: '' })
  const single = row(page, 'Single entry')
  await expect(single).toHaveCount(1)
  await minus(single).click()
  await expect(page.getByText('Finished (1)')).toBeVisible()
  await expect(row(page, 'Single entry')).toHaveCount(0)
  await expect(page.getByText(/Climb Central, Single entry moved to Finished/)).toBeVisible()

  // Few entries left: the row says Low at once, but no banner is pushed in while tapping (D42).
  await addPass(page, 'Fitbloc', { entries: '3', expiry: '+6' })
  await minus(row(page, '3 / 3')).click()
  await expect(row(page, '2 / 3').getByText('Low', { exact: true })).toBeVisible()
  await expect(banners(page).getByText('Fitbloc, Multipass: 2 entries left')).toHaveCount(0)
  // The next time the app is opened, the banner is there and its row is highlighted.
  await page.reload()
  await expect(banners(page).getByText('Fitbloc, Multipass: 2 entries left')).toBeVisible()
  await expect(row(page, '2 / 3').getByText('Has a reminder.')).toBeAttached()

  // Settings: the data is only on this device, and it can be downloaded.
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText('only on this device')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup file' }).click()
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8')) as {
    passes: { gymRef: unknown }[]
    userGyms: { name: string }[]
  }
  expect(backup.passes).toHaveLength(5)
  // Fitbloc was typed more than once, in different cases, but it is one gym with three passes.
  expect(backup.userGyms.map((g) => g.name).sort()).toEqual([
    'Climb Central',
    'Fitbloc',
    'Zig Zag Wall',
  ])
  expect(new Set(backup.passes.map((p) => JSON.stringify(p.gymRef))).size).toBe(3)
  await page.getByRole('link', { name: /Passes/ }).click()

  // The gym typed in a different case did not make a second gym.
  await openAddRow(page)
  await gymBox(page).fill('fitb')
  await expect(page.getByRole('option', { name: /^Fitbloc$/ })).toHaveCount(1)
  await gymBox(page).fill('')

  // Everything above still works with no network, and is there after a reload.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(mainRows(page)).toHaveCount(5 - 1) // four rows; the single entry is in Finished
  await minus(row(page, '8 / 10')).click()
  await expect(row(page, '7 / 10')).toHaveCount(1)
  await addPass(page, 'Offline Wall', { entries: '5', expiry: '+6' })
  await expect(row(page, '5 / 5')).toHaveCount(1)
  await page.getByRole('link', { name: 'Settings' }).click()
  const offlineDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup file' }).click()
  expect((await readFile((await (await offlineDownload).path())!, 'utf8')).length).toBeGreaterThan(
    20,
  )

  await context.setOffline(false)
  await page.goto('/')
  await expect(row(page, '7 / 10')).toHaveCount(1)
  await expect(row(page, '5 / 5')).toHaveCount(1)
  await expect(mainRows(page)).toHaveCount(5)
})
