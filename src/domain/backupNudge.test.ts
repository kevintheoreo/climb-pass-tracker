import { addDays } from './dates'
import { backupNudge, BACKUP_NUDGE_DAYS } from './backupNudge'

const today = '2026-10-04'
const at = (daysAgo: number) => `${addDays(today, -daysAgo)}T12:00:00.000Z`
const base = {
  today,
  hasPasses: true,
  lastBackupAt: null,
  firstPassAt: at(100),
  snoozedUntil: null,
} as const

describe('backupNudge', () => {
  it('asks once the last backup is 30 days old, not before', () => {
    const lastBackupAt = (days: number) => ({ ...base, lastBackupAt: at(days) })
    expect(backupNudge(lastBackupAt(BACKUP_NUDGE_DAYS - 1))).toEqual({ show: false })
    expect(backupNudge(lastBackupAt(BACKUP_NUDGE_DAYS))).toEqual({
      show: true,
      daysSince: 30,
      never: false,
    })
    expect(backupNudge(lastBackupAt(75))).toMatchObject({ show: true, daysSince: 75 })
  })

  it('with no backup ever, counts from the first pass', () => {
    expect(backupNudge({ ...base, firstPassAt: at(29) })).toEqual({ show: false })
    expect(backupNudge({ ...base, firstPassAt: at(30) })).toEqual({
      show: true,
      daysSince: 30,
      never: true,
    })
  })

  it('a backup newer than the first pass is what counts', () => {
    expect(backupNudge({ ...base, lastBackupAt: at(3), firstPassAt: at(300) })).toEqual({
      show: false,
    })
  })

  it('has nothing to ask for without passes', () => {
    expect(backupNudge({ ...base, hasPasses: false })).toEqual({ show: false })
    expect(backupNudge({ ...base, firstPassAt: null })).toEqual({ show: false })
  })

  it('stays away until the snooze day, and comes back on it', () => {
    expect(backupNudge({ ...base, snoozedUntil: addDays(today, 1) })).toEqual({ show: false })
    expect(backupNudge({ ...base, snoozedUntil: today })).toMatchObject({ show: true })
    expect(backupNudge({ ...base, snoozedUntil: addDays(today, -3) })).toMatchObject({ show: true })
  })

  it('a backup taken after the snooze starts the 30 days again', () => {
    expect(
      backupNudge({ ...base, lastBackupAt: at(1), snoozedUntil: addDays(today, -20) }),
    ).toEqual({ show: false })
  })
})
