import { DROPBOX_BACKUP_PATH } from '../../domain/dropbox'

/**
 * The few Dropbox web calls the optional backup needs (D59, FR-78). Sign-in is OAuth 2 with PKCE, so
 * it works in the browser with no server and no secret: only the public app key is used. The app
 * asks for access to its own app folder, nothing else in the person's Dropbox.
 */

const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke'
const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata'
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload'
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download'

const VERIFIER_KEY = 'dropbox-verifier'
const STATE_KEY = 'dropbox-state'

/** The app key, or undefined while the Dropbox backup is switched off (no key in this build). */
export const dropboxAppKey = (): string | undefined =>
  import.meta.env.VITE_DROPBOX_APP_KEY || undefined

/** Where Dropbox sends the person back to. It must be registered, exactly, in the Dropbox app. */
export const redirectUri = (): string => `${window.location.origin}/settings`

/** Why a call failed, in the terms the screen cares about. */
export type DropboxFailure = 'signed-out' | 'full' | 'missing' | 'network' | 'other'

/** Not called NotFoundError: Dexie rewrites errors with that name. */
export class DropboxError extends Error {
  readonly failure: DropboxFailure
  constructor(failure: DropboxFailure) {
    super(`Dropbox: ${failure}`)
    this.name = 'DropboxError'
    this.failure = failure
  }
}

/** The words shown to the person for each failure. */
export function failureMessage(failure: DropboxFailure): string {
  switch (failure) {
    case 'signed-out':
      return 'Dropbox signed you out. Connect again to carry on backing up.'
    case 'full':
      return 'Your Dropbox is full, so the backup was not saved. Free up some space and try again.'
    case 'missing':
      return 'There is no backup in your Dropbox yet.'
    case 'network':
      return 'Could not reach Dropbox. It will try again the next time you open the app.'
    default:
      return 'Dropbox did not accept the backup. It will try again the next time you open the app.'
  }
}

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomString = (): string => base64Url(crypto.getRandomValues(new Uint8Array(48)))

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** The values saved before leaving for Dropbox, read back when the person returns. */
export function savedState(): string | null {
  try {
    return sessionStorage.getItem(STATE_KEY)
  } catch {
    return null
  }
}

/** Saves what the return needs and gives the address of Dropbox's sign-in page. */
export async function signInUrl(appKey: string): Promise<string> {
  const verifier = randomString()
  const state = randomString()
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
  } catch {
    throw new DropboxError('other')
  }
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    redirect_uri: redirectUri(),
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

async function tokenCall(body: Record<string, string>): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams(body) })
  } catch {
    throw new DropboxError('network')
  }
  if (response.status === 400 || response.status === 401) throw new DropboxError('signed-out')
  if (!response.ok) throw new DropboxError('other')
  return (await response.json()) as Record<string, unknown>
}

const expiry = (seconds: unknown, now: number): string =>
  new Date(now + (typeof seconds === 'number' ? seconds : 14_400) * 1000).toISOString()

/** The saved PKCE verifier, removed from storage as it is read: a sign-in return works once. */
function takeVerifier(): string | null {
  try {
    const verifier = sessionStorage.getItem(VERIFIER_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
    sessionStorage.removeItem(STATE_KEY)
    return verifier
  } catch {
    return null
  }
}

/** Trades the code Dropbox sent back for tokens. Used once; the saved values are removed. */
export async function finishSignIn(
  appKey: string,
  code: string,
  now: number = Date.now(),
): Promise<Tokens> {
  const verifier = takeVerifier()
  if (verifier === null) throw new DropboxError('signed-out')
  const json = await tokenCall({
    grant_type: 'authorization_code',
    code,
    client_id: appKey,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  if (typeof json.access_token !== 'string' || typeof json.refresh_token !== 'string') {
    throw new DropboxError('other')
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: expiry(json.expires_in, now),
  }
}

/** Gets a fresh access token from the long-lasting one. */
export async function refreshTokens(
  appKey: string,
  refreshToken: string,
  now: number = Date.now(),
): Promise<Tokens> {
  const json = await tokenCall({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: appKey,
  })
  if (typeof json.access_token !== 'string') throw new DropboxError('other')
  return { accessToken: json.access_token, refreshToken, expiresAt: expiry(json.expires_in, now) }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new DropboxError('network')
  }
}

/** Reads a failed answer: out of space, no such file, signed out, or something else. */
async function failureOf(response: Response): Promise<DropboxError> {
  if (response.status === 401) return new DropboxError('signed-out')
  const text = await response.text().catch(() => '')
  if (/insufficient_space/.test(text)) return new DropboxError('full')
  if (response.status === 409 && /not_found/.test(text)) return new DropboxError('missing')
  return new DropboxError('other')
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })
const pathArg = (extra: object = {}): string =>
  JSON.stringify({ path: DROPBOX_BACKUP_PATH, ...extra })

/** Puts the backup in the app folder, replacing the one there (Dropbox keeps older versions). */
export async function uploadBackup(token: string, text: string): Promise<void> {
  const response = await send(UPLOAD_URL, {
    method: 'POST',
    headers: {
      ...bearer(token),
      'Dropbox-API-Arg': pathArg({ mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: text,
  })
  if (!response.ok) throw await failureOf(response)
}

/** Is there already a backup in the app folder. */
export async function remoteBackupExists(token: string): Promise<boolean> {
  const response = await send(METADATA_URL, {
    method: 'POST',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: pathArg(),
  })
  if (response.ok) return true
  const failure = await failureOf(response)
  if (failure.failure === 'missing') return false
  throw failure
}

/** The text of the backup in the app folder. */
export async function downloadBackupText(token: string): Promise<string> {
  const response = await send(DOWNLOAD_URL, {
    method: 'POST',
    headers: { ...bearer(token), 'Dropbox-API-Arg': pathArg() },
  })
  if (!response.ok) throw await failureOf(response)
  return response.text()
}

/** Tells Dropbox to stop honouring the token. Best effort: the app forgets it either way. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, { method: 'POST', headers: bearer(token) })
  } catch {
    // Offline: the person can still remove the app under Dropbox's own settings.
  }
}
