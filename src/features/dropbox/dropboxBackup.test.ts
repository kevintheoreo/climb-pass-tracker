import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'
import { signInUrl } from './dropboxApi'
import {
  backupNow,
  checkBeforeBackup,
  connect,
  disconnect,
  fetchBackupText,
  readConnection,
  runAutoBackup,
} from './dropboxBackup'
import { fakeDropbox, type FakeDropbox } from './fakeDropbox'

const today = todayLocal()
const pass = (): PassInput => ({
  gymRef: { kind: 'builtin', id: BUILTIN_GYMS[0]!.id },
  passType: 'multipass',
  priceCents: null,
  comments: null,
  purchaseDate: addDays(today, -5),
  expiryDate: addDays(today, 90),
  totalEntries: 10,
  initialUsed: 0,
})

let dropbox: FakeDropbox

/** Signs in the way the screen does: the sign-in page's address, then the code that comes back. */
async function signIn() {
  await signInUrl('test-app-key')
  await connect('the-code')
}

beforeEach(async () => {
  vi.stubEnv('VITE_DROPBOX_APP_KEY', 'test-app-key')
  sessionStorage.clear()
  dropbox = fakeDropbox()
  vi.stubGlobal('fetch', dropbox.fetch)
  await repo.clearAllData()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('signing in', () => {
  it('goes to Dropbox with PKCE, asks for a long-lasting token, and sends back to Settings', async () => {
    const url = new URL(await signInUrl('test-app-key'))
    expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('test-app-key')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('token_access_type')).toBe('offline')
    expect(url.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/settings`)
    expect(url.searchParams.get('state')).toBe(sessionStorage.getItem('dropbox-state'))
  })

  it('trades the code (with the saved verifier) for tokens and keeps them on the device', async () => {
    await signIn()
    const call = dropbox.calls.find((c) => c.url.endsWith('/oauth2/token'))!
    const sent = new URLSearchParams(call.body)
    expect(sent.get('code')).toBe('the-code')
    expect(sent.get('code_verifier')).toBeTruthy()
    expect(sent.get('client_secret')).toBeNull()
    expect(await readConnection()).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      lastBackupAt: null,
      needsChoice: false,
      signedOut: false,
    })
    // The saved values are used once.
    expect(sessionStorage.getItem('dropbox-verifier')).toBeNull()
    await expect(connect('again')).rejects.toMatchObject({ failure: 'signed-out' })
  })
})

describe('backing up now', () => {
  it('writes the backup into the app folder, replacing the file, and counts as a backup', async () => {
    await signIn()
    await repo.createPass(pass())
    await backupNow()
    const upload = dropbox.calls.find((c) => c.url.endsWith('/files/upload'))!
    expect(JSON.parse(upload.arg!)).toEqual({
      path: '/climb-pass-tracker-backup.json',
      mode: 'overwrite',
      mute: true,
    })
    expect(upload.auth).toBe('Bearer access-1')
    expect(JSON.parse(dropbox.file!).passes).toHaveLength(1)
    const connection = await readConnection()
    expect(connection?.lastBackupAt).not.toBeNull()
    expect((await repo.getBackupState()).lastBackupAt).not.toBeNull()
  })

  it('never puts the tokens in the backup', async () => {
    await signIn()
    await repo.createPass(pass())
    await backupNow()
    expect(dropbox.file).not.toMatch(/refresh-1|access-1/)
  })

  it('asks for a new access token when the old one has run out', async () => {
    await signIn()
    await repo.createPass(pass())
    await repo.setMeta('dropbox', {
      ...(await readConnection())!,
      expiresAt: '2020-01-01T00:00:00Z',
    })
    await backupNow()
    expect(dropbox.calls.some((c) => /refresh_token/.test(c.body ?? ''))).toBe(true)
    expect(dropbox.calls.find((c) => c.url.endsWith('/files/upload'))!.auth).toBe('Bearer access-2')
  })

  it('says why it failed and remembers it: Dropbox full, offline, or signed out', async () => {
    await signIn()
    await repo.createPass(pass())
    dropbox.mode = 'full'
    await expect(backupNow()).rejects.toMatchObject({ failure: 'full' })
    expect((await readConnection())?.lastError).toMatch(/Dropbox is full/)
    dropbox.mode = 'offline'
    await expect(backupNow()).rejects.toMatchObject({ failure: 'network' })
    dropbox.mode = 'signed-out'
    await expect(backupNow()).rejects.toMatchObject({ failure: 'signed-out' })
    expect(await readConnection()).toMatchObject({ signedOut: true })
    dropbox.mode = 'ok'
    await backupNow()
    expect(await readConnection()).toMatchObject({ signedOut: false, lastError: null })
  })

  it('marks the connection signed out when Dropbox refuses to renew the token', async () => {
    await signIn()
    await repo.createPass(pass())
    await repo.setMeta('dropbox', {
      ...(await readConnection())!,
      expiresAt: '2020-01-01T00:00:00Z',
    })
    dropbox.rejectRefresh = true
    await expect(backupNow()).rejects.toMatchObject({ failure: 'signed-out' })
    expect(await readConnection()).toMatchObject({ signedOut: true })
  })
})

describe('guards on Back up now (checkBeforeBackup, backupNow)', () => {
  it('never replaces a backup with an empty one: refused, nothing sent', async () => {
    dropbox.file = '{"precious":true}'
    await signIn()
    dropbox.calls.length = 0
    await expect(backupNow()).rejects.toMatchObject({ failure: 'empty' })
    await expect(checkBeforeBackup()).rejects.toMatchObject({ failure: 'empty' })
    expect(dropbox.file).toBe('{"precious":true}')
    expect(dropbox.calls).toHaveLength(0)
    // A refusal is not a Dropbox failure: nothing is remembered as an error.
    expect((await readConnection())?.lastError).toBeNull()
  })

  it('a phone that never backed up must ask when Dropbox already holds a backup', async () => {
    dropbox.file = '{"other":"phone"}'
    await signIn()
    await repo.createPass(pass())
    await expect(checkBeforeBackup()).resolves.toBe('replaces')
  })

  it('a phone that never backed up goes ahead when Dropbox holds nothing', async () => {
    await signIn()
    await repo.createPass(pass())
    await expect(checkBeforeBackup()).resolves.toBe('ok')
  })

  it('a phone that already backs up goes ahead without asking, and without a Dropbox look', async () => {
    await signIn()
    await repo.createPass(pass())
    await backupNow()
    dropbox.calls.length = 0
    await expect(checkBeforeBackup()).resolves.toBe('ok')
    expect(dropbox.calls).toHaveLength(0)
  })

  it('a phone waiting for the choice asks', async () => {
    dropbox.file = '{"other":"phone"}'
    await signIn()
    await repo.createPass(pass())
    await runAutoBackup(today)
    await expect(checkBeforeBackup()).resolves.toBe('replaces')
  })
})

describe('the daily backup (runAutoBackup)', () => {
  it('does nothing when Dropbox is not connected', async () => {
    await repo.createPass(pass())
    await runAutoBackup(today)
    expect(dropbox.calls).toHaveLength(0)
  })

  it('does not back up an empty app', async () => {
    await signIn()
    dropbox.calls.length = 0
    await runAutoBackup(today)
    expect(dropbox.calls).toHaveLength(0)
  })

  it('backs up on the first opening when Dropbox holds nothing yet', async () => {
    await signIn()
    await repo.createPass(pass())
    await runAutoBackup(today)
    expect(dropbox.file).not.toBeNull()
    expect((await readConnection())?.lastBackupAt).not.toBeNull()
  })

  it('backs up once a day: not again the same day, again the next', async () => {
    await signIn()
    await repo.createPass(pass())
    await runAutoBackup(today)
    const uploads = () => dropbox.calls.filter((c) => c.url.endsWith('/files/upload')).length
    expect(uploads()).toBe(1)
    await runAutoBackup(today)
    expect(uploads()).toBe(1)
    await runAutoBackup(addDays(today, 1))
    expect(uploads()).toBe(2)
  })

  it('never replaces a backup that came from another phone: it waits for a choice', async () => {
    dropbox.file = '{"from":"another phone"}'
    await signIn()
    await repo.createPass(pass())
    await runAutoBackup(today)
    expect(dropbox.file).toBe('{"from":"another phone"}')
    expect(await readConnection()).toMatchObject({ needsChoice: true, lastBackupAt: null })
    // And stays waiting on later days.
    await runAutoBackup(addDays(today, 3))
    expect(dropbox.file).toBe('{"from":"another phone"}')
    // Back up now is the person's choice to replace it.
    await backupNow()
    expect(JSON.parse(dropbox.file!).passes).toHaveLength(1)
    expect((await readConnection())?.needsChoice).toBe(false)
  })

  it('swallows a failure and remembers it for Settings', async () => {
    await signIn()
    await repo.createPass(pass())
    dropbox.mode = 'full'
    await expect(runAutoBackup(today)).resolves.toBeUndefined()
    expect((await readConnection())?.lastError).toMatch(/full/)
  })

  it('stays quiet once signed out', async () => {
    await signIn()
    await repo.createPass(pass())
    await repo.setMeta('dropbox', { ...(await readConnection())!, signedOut: true })
    dropbox.calls.length = 0
    await runAutoBackup(today)
    expect(dropbox.calls).toHaveLength(0)
  })
})

describe('restoring and disconnecting', () => {
  it('fetches the text of the backup in Dropbox', async () => {
    dropbox.file = '{"hello":1}'
    await signIn()
    await expect(fetchBackupText()).resolves.toBe('{"hello":1}')
  })

  it('says there is no backup when there is none', async () => {
    await signIn()
    await expect(fetchBackupText()).rejects.toMatchObject({ failure: 'missing' })
  })

  it('disconnecting forgets the tokens, tells Dropbox, and leaves the file', async () => {
    dropbox.file = '{"keep":true}'
    await signIn()
    await disconnect()
    expect(await readConnection()).toBeNull()
    expect(dropbox.calls.some((c) => c.url.endsWith('/auth/token/revoke'))).toBe(true)
    expect(dropbox.file).toBe('{"keep":true}')
  })

  it('Delete all data removes the connection with everything else', async () => {
    await signIn()
    await repo.clearAllData()
    expect(await readConnection()).toBeNull()
  })
})
