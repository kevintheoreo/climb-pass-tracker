import { daysBetween, localDateOfTimestamp, type LocalDate } from './dates'

/**
 * The reminder to download a backup file (D47). Passes live only on the phone, so a backup is the
 * only way back from a lost phone or cleared browser data; this asks for one now and then.
 */

/** Ask once the last backup (or the first pass, when there never was one) is this many days old. */
export const BACKUP_NUDGE_DAYS = 30

/** "Remind me later" hides the reminder for this many days. */
export const BACKUP_SNOOZE_DAYS = 7

export type BackupNudge = { show: false } | { show: true; daysSince: number; never: boolean }

export function backupNudge({
  today,
  hasPasses,
  lastBackupAt,
  firstPassAt,
  snoozedUntil,
}: {
  today: LocalDate
  /** There is something to lose. */
  hasPasses: boolean
  /** When a backup file was last downloaded (a timestamp), or null if never. */
  lastBackupAt: string | null
  /** When the oldest pass was added (a timestamp): the clock starts here if there was no backup. */
  firstPassAt: string | null
  /** The day the reminder may come back after "Remind me later", or null. */
  snoozedUntil: LocalDate | null
}): BackupNudge {
  if (!hasPasses) return { show: false }
  const since = lastBackupAt ?? firstPassAt
  if (since === null) return { show: false }
  const daysSince = daysBetween(localDateOfTimestamp(since), today)
  if (daysSince < BACKUP_NUDGE_DAYS) return { show: false }
  if (snoozedUntil !== null && today < snoozedUntil) return { show: false }
  return { show: true, daysSince, never: lastBackupAt === null }
}
