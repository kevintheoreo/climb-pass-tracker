import { localDateOfTimestamp, type LocalDate } from './dates'

/**
 * The rules of the optional Dropbox backup (D59, FR-78). Pure: no network, no clock. The app keeps
 * one backup file in its own Dropbox app folder and replaces it at most once a day, when the app is
 * opened; nothing runs in the background.
 */

/** The one file, inside the app's own folder in the person's Dropbox. Dropbox keeps older versions. */
export const DROPBOX_BACKUP_PATH = '/climb-pass-tracker-backup.json'

/** Is the daily backup due: none made yet, or the last one was on an earlier day. */
export function dropboxBackupDue(lastBackupAt: string | null, today: LocalDate): boolean {
  return lastBackupAt === null || localDateOfTimestamp(lastBackupAt) < today
}

export type AuthReturn =
  { kind: 'none' } | { kind: 'denied' } | { kind: 'mismatch' } | { kind: 'code'; code: string }

/**
 * Reads the address Dropbox sends the person back to after the sign-in page. `expectedState` is the
 * random value saved before leaving: a different one means the return did not start here.
 */
export function parseAuthReturn(search: string, expectedState: string | null): AuthReturn {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const error = params.get('error')
  if (code === null && error === null) return { kind: 'none' }
  if (expectedState === null || params.get('state') !== expectedState) return { kind: 'mismatch' }
  if (error !== null || code === null) return { kind: 'denied' }
  return { kind: 'code', code }
}

/** What is kept on the device about the connection (in `meta`, never in a backup file). */
export interface DropboxConnection {
  refreshToken: string
  accessToken: string
  /** When the access token stops working (a timestamp). */
  expiresAt: string
  /** When the last backup to Dropbox was made (a timestamp), or null. */
  lastBackupAt: string | null
  /**
   * This device has not backed up yet and Dropbox already holds a backup (from another phone): it
   * waits for the person to restore it or to choose "Back up now", so it never replaces it unasked.
   */
  needsChoice: boolean
  /** Dropbox no longer accepts the sign-in: the person has to connect again. */
  signedOut: boolean
  /** What went wrong last time, in words for the person; null when the last try worked. */
  lastError: string | null
}

export function isDropboxConnection(value: unknown): value is DropboxConnection {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.refreshToken === 'string' &&
    typeof v.accessToken === 'string' &&
    typeof v.expiresAt === 'string' &&
    (v.lastBackupAt === null || typeof v.lastBackupAt === 'string') &&
    typeof v.needsChoice === 'boolean' &&
    typeof v.signedOut === 'boolean' &&
    (v.lastError === null || typeof v.lastError === 'string')
  )
}
