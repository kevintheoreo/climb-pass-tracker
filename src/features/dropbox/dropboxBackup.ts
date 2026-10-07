import { repo } from '../../db'
import { backupToText } from '../../domain/backup'
import type { LocalDate } from '../../domain/dates'
import { dropboxBackupDue, isDropboxConnection, type DropboxConnection } from '../../domain/dropbox'
import {
  DropboxError,
  downloadBackupText,
  dropboxAppKey,
  failureMessage,
  finishSignIn,
  refreshTokens,
  remoteBackupExists,
  revokeToken,
  uploadBackup,
} from './dropboxApi'

/**
 * The optional Dropbox backup (D59, FR-78): what is kept about the connection, and the backup and
 * restore steps. The connection lives in `meta` on this device only, and is never part of a backup
 * file. The daily backup runs when the app is opened (`runAutoBackup`), at most once a day.
 */

const META_KEY = 'dropbox'

export async function readConnection(): Promise<DropboxConnection | null> {
  const value = await repo.getMeta<unknown>(META_KEY)
  return isDropboxConnection(value) ? value : null
}

const writeConnection = (connection: DropboxConnection | null) => repo.setMeta(META_KEY, connection)

const nowIso = () => new Date().toISOString()

/** Saves the tokens from a finished sign-in as a new connection with no backup made yet. */
export async function connect(code: string): Promise<void> {
  const appKey = dropboxAppKey()
  if (!appKey) throw new DropboxError('other')
  const tokens = await finishSignIn(appKey, code)
  await writeConnection({
    ...tokens,
    lastBackupAt: null,
    needsChoice: false,
    signedOut: false,
    lastError: null,
  })
}

/** Forgets the connection and asks Dropbox to stop honouring it. The file in Dropbox stays. */
export async function disconnect(): Promise<void> {
  const connection = await readConnection()
  await writeConnection(null)
  if (connection) await revokeToken(connection.accessToken)
}

async function record(change: Partial<DropboxConnection>): Promise<void> {
  const connection = await readConnection()
  if (connection) await writeConnection({ ...connection, ...change })
}

/** An access token that works now, fetching a new one when the old one is about to run out. */
async function accessToken(connection: DropboxConnection): Promise<string> {
  if (Date.parse(connection.expiresAt) - Date.now() > 60_000) return connection.accessToken
  const appKey = dropboxAppKey()
  if (!appKey) throw new DropboxError('other')
  const tokens = await refreshTokens(appKey, connection.refreshToken)
  await writeConnection({ ...connection, ...tokens })
  return tokens.accessToken
}

/**
 * Runs one Dropbox call with a working token. A failure is remembered for the Settings screen (and
 * a refused sign-in marks the connection as signed out) and then thrown, so a person pressing a
 * button sees it; the daily run swallows it.
 */
async function withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
  const connection = await readConnection()
  if (!connection) throw new DropboxError('signed-out')
  try {
    const result = await call(await accessToken(connection))
    return result
  } catch (failure) {
    if (failure instanceof DropboxError) {
      if (failure.failure === 'missing') throw failure
      await record({
        lastError: failureMessage(failure.failure),
        signedOut: failure.failure === 'signed-out',
      })
    }
    throw failure
  }
}

/**
 * What pressing Back up now needs first. An empty phone is refused (an empty backup would replace
 * a good one, and nobody needs one: `DropboxError('empty')`). A phone that has not backed up yet
 * must ask first when Dropbox already holds a backup, which is probably another phone's or an
 * earlier one of this phone's; so must one that is already waiting for that choice.
 */
export async function checkBeforeBackup(): Promise<'ok' | 'replaces'> {
  if ((await repo.listPasses()).length === 0) throw new DropboxError('empty')
  const connection = await readConnection()
  if (connection?.needsChoice) return 'replaces'
  if (connection && connection.lastBackupAt === null && (await withToken(remoteBackupExists))) {
    return 'replaces'
  }
  return 'ok'
}

/** Puts what is on this device in Dropbox, replacing the earlier backup there. */
export async function backupNow(): Promise<void> {
  // Never replace a backup with an empty one, whoever asks.
  if ((await repo.listPasses()).length === 0) throw new DropboxError('empty')
  const text = backupToText(await repo.exportBackup())
  await withToken((token) => uploadBackup(token, text))
  await record({ lastBackupAt: nowIso(), needsChoice: false, signedOut: false, lastError: null })
  await repo.markBackedUp()
}

/** The text of the backup in Dropbox, for the person to look over and add to this device. */
export const fetchBackupText = (): Promise<string> => withToken(downloadBackupText)

/** The device now holds what the Dropbox backup holds: the daily backup may carry on from here. */
export async function markRestored(): Promise<void> {
  await record({ lastBackupAt: nowIso(), needsChoice: false, lastError: null })
}

let running: Promise<void> | null = null

/**
 * The daily backup, run when the app is opened. It backs up only when a day has passed, only when
 * there is something to back up, and never replaces a backup that came from another phone: on a
 * device that has not backed up yet it first looks, and if Dropbox already holds one it waits for
 * the person to choose (`needsChoice`).
 */
export function runAutoBackup(today: LocalDate): Promise<void> {
  running ??= autoBackup(today).finally(() => {
    running = null
  })
  return running
}

async function autoBackup(today: LocalDate): Promise<void> {
  const connection = await readConnection()
  if (!connection || connection.signedOut || connection.needsChoice) return
  if (!dropboxBackupDue(connection.lastBackupAt, today)) return
  if ((await repo.listPasses()).length === 0) return
  try {
    if (connection.lastBackupAt === null) {
      if (await withToken(remoteBackupExists)) {
        await record({ needsChoice: true, lastError: null })
        return
      }
    }
    await backupNow()
  } catch {
    // Remembered in `lastError` for Settings; the next opening tries again.
  }
}
