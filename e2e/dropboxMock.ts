import type { Page } from '@playwright/test'

/**
 * A pretend Dropbox for the browser tests. The sign-in page sends the person straight back with a
 * code, the token and file calls answer from memory, and the cross-site permission checks (CORS) a
 * real Dropbox answers are answered too. Nothing leaves the machine.
 */
export interface MockDropbox {
  /** The backup file as the pretend Dropbox holds it, or null. */
  file: string | null
  /** The addresses called, in order. */
  calls: string[]
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export async function mockDropbox(page: Page, file: string | null = null): Promise<MockDropbox> {
  const dropbox: MockDropbox = { file, calls: [] }

  await page.route('https://www.dropbox.com/oauth2/authorize*', (route) => {
    const url = new URL(route.request().url())
    const back = new URL(url.searchParams.get('redirect_uri')!)
    back.searchParams.set('code', 'test-code')
    back.searchParams.set('state', url.searchParams.get('state')!)
    return route.fulfill({ status: 302, headers: { location: back.toString() } })
  })

  const answer = async (route: import('@playwright/test').Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = request.url()
    dropbox.calls.push(url)
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
    if (url.endsWith('/oauth2/token')) {
      return json({ access_token: 'access', refresh_token: 'refresh', expires_in: 14400 })
    }
    if (url.endsWith('/auth/token/revoke')) return json(null)
    if (url.endsWith('/files/upload')) {
      dropbox.file = request.postData() ?? ''
      return json({ name: 'climb-pass-tracker-backup.json' })
    }
    if (url.endsWith('/files/get_metadata') || url.endsWith('/files/download')) {
      if (dropbox.file === null) return json({ error_summary: 'path/not_found/' }, 409)
      return url.endsWith('/files/download')
        ? route.fulfill({ status: 200, headers: cors, body: dropbox.file })
        : json({ name: 'climb-pass-tracker-backup.json' })
    }
    return json({}, 404)
  }
  await page.route('https://api.dropboxapi.com/**', answer)
  await page.route('https://content.dropboxapi.com/**', answer)
  return dropbox
}
