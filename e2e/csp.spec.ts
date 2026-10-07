import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { mockDropbox } from './dropboxMock'

// The app under the production security headers. netlify.toml sets a Content-Security-Policy on every
// page; here the very same policy is added to the pages the preview server sends, and the app's
// features are used. Any blocked script, style, image or connection is a failure. (The service worker
// is blocked in this test only because the test cannot add headers to what the worker sends; the
// worker itself is covered by the offline tests.)
test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' })

async function policy(): Promise<string> {
  const toml = await readFile('netlify.toml', 'utf8')
  const match = /Content-Security-Policy = "([^"]+)"/.exec(toml)
  if (!match) throw new Error('netlify.toml has no Content-Security-Policy')
  return match[1]!
}

test('the app works under the production Content-Security-Policy', async ({ page }) => {
  const csp = await policy()
  expect(csp).toContain("default-src 'none'")
  expect(csp).toContain(
    "connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com",
  )
  await page.route('**/*', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    })
  })
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __csp: string[] }).__csp = seen
    document.addEventListener('securitypolicyviolation', (e) => {
      seen.push(`${e.violatedDirective}: ${e.blockedURI} (${e.sample})`)
    })
  })
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  page.on('console', (m) => {
    if (/content security policy|refused to/i.test(m.text())) problems.push(m.text())
  })
  const violations = () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)

  // Add a pass, use an entry, edit it, start Buy again.
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Gym' }).fill('Csp Wall')
  await page.getByLabel('Entries', { exact: true }).fill('3')
  await page.getByRole('button', { name: '+6 months' }).click()
  await page.getByRole('button', { name: 'Add pass', exact: true }).click()
  const rows = page.getByRole('list', { name: 'Passes', exact: true }).locator(':scope > li')
  await expect(rows).toHaveCount(1)
  await rows.getByRole('button', { name: /^Use one entry/ }).click()
  await expect(rows.filter({ hasText: '2 / 3' })).toHaveCount(1)
  await rows.getByRole('button', { name: /details$/ }).click()
  await page.getByLabel(/^Comments/).fill('note')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Changes saved')).toBeVisible()
  await rows.getByRole('button', { name: /details$/ }).click()
  await page.getByRole('button', { name: 'Buy again' }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  // The backup file: download one and open it again.
  await page.getByRole('link', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup file' }).click()
  const file = await download
  await page.getByLabel('Open a backup file').setInputFiles((await file.path())!)
  await expect(
    page.getByText(/already on this phone|can be added|nothing to add/i).first(),
  ).toBeVisible()

  // The optional Dropbox backup: sign in, back up and restore, with the page's connections held to
  // the policy (only the two Dropbox addresses may be called).
  await mockDropbox(page)
  await page.getByRole('button', { name: 'Connect Dropbox', exact: true }).click()
  await expect(page.getByText('Dropbox is connected.').first()).toBeVisible()
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText('Backed up to Dropbox.')).toBeVisible()
  await page.getByRole('button', { name: 'Restore from Dropbox' }).click()
  await expect(page.getByRole('region', { name: 'Backup preview' })).toBeVisible()

  // The other screens.
  await page.goto('/about')
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
  await page.goto('/terms')
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()

  expect(await violations()).toEqual([])
  expect(problems).toEqual([])
})
