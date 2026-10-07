// A pretend Dropbox for tests: answers the few calls the optional backup makes and keeps the one file.
// Not used by app code.

export interface FakeDropbox {
  fetch: typeof fetch
  /** The backup file as Dropbox holds it, or null when there is none. */
  file: string | null
  /** Every request made, in order: the address and (for uploads) the Dropbox-API-Arg header. */
  calls: { url: string; arg?: string; auth?: string; body?: string }[]
  /** Make the next calls fail the way Dropbox does: out of space, or a sign-in it no longer knows. */
  mode: 'ok' | 'full' | 'signed-out' | 'offline' | 'refused'
  /** The token endpoint refuses a refresh (the person removed the app in Dropbox). */
  rejectRefresh: boolean
}

export function fakeDropbox(file: string | null = null): FakeDropbox {
  const state: FakeDropbox = {
    file,
    calls: [],
    mode: 'ok',
    rejectRefresh: false,
    fetch: async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      const body = typeof init?.body === 'string' ? init.body : init?.body?.toString()
      state.calls.push({
        url,
        arg: headers.get('Dropbox-API-Arg') ?? undefined,
        auth: headers.get('Authorization') ?? undefined,
        body,
      })
      if (state.mode === 'offline') throw new TypeError('Failed to fetch')
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })

      if (url.endsWith('/oauth2/token')) {
        const params = new URLSearchParams(body)
        if (params.get('grant_type') === 'refresh_token') {
          return state.rejectRefresh
            ? json({ error: 'invalid_grant' }, 400)
            : json({ access_token: 'access-2', expires_in: 14400 })
        }
        return json({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 14400 })
      }
      if (url.endsWith('/auth/token/revoke')) return json(null)
      if (state.mode === 'signed-out') return json({ error_summary: 'invalid_access_token/' }, 401)
      if (url.endsWith('/files/upload')) {
        if (state.mode === 'refused') {
          return json({ error_summary: 'path/no_write_permission/..' }, 409)
        }
        if (state.mode === 'full') {
          return json({ error_summary: 'path/insufficient_space/' }, 409)
        }
        state.file = body ?? ''
        return json({ name: 'climb-pass-tracker-backup.json' })
      }
      if (url.endsWith('/files/get_metadata') || url.endsWith('/files/download')) {
        if (state.file === null) return json({ error_summary: 'path/not_found/' }, 409)
        return url.endsWith('/files/download')
          ? new Response(state.file)
          : json({ name: 'climb-pass-tracker-backup.json' })
      }
      return json({}, 404)
    },
  }
  return state
}
