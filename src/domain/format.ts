import { formatDate, formatDayMonth, type LocalDate } from './dates'
import type { PassStatus } from './passStatus'
import type { ImportSummary } from './backup'
import type { Reminder } from './reminders'
import type { Pass } from './types'

/** "today", "tomorrow", "in 12 days", "yesterday", "10 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** The Expiry column: the date, or "No expiry" for a single entry without one. */
export function expiryLabel(expiry: LocalDate | null): string {
  return expiry === null ? 'No expiry' : formatDate(expiry)
}

/** The Left column: `7 / 10`, or "Unlimited" for a membership without a monthly allowance. */
export function leftLabel(status: PassStatus): string {
  if (status.entriesLeft === null || status.total === null) return 'Unlimited'
  return `${status.entriesLeft} / ${status.total}`
}

/** "resets 15 Nov" for a membership with a monthly allowance, otherwise null. */
export function resetLabel(status: PassStatus): string | null {
  return status.nextReset === null ? null : `resets ${formatDayMonth(status.nextReset)}`
}

export type BadgeTone = 'warn' | 'info' | 'muted'

export interface Badge {
  label: string
  tone: BadgeTone
}

/**
 * The status badges for a row (FR-6): *Frozen*, *Expiring soon* and *Low* on the main list;
 * *Used up* or *Expired – X unused* in the Finished section. Active rows with nothing to flag get
 * none.
 */
export function badgesFor(pass: Pass, status: PassStatus): Badge[] {
  if (status.state === 'used_up') return [{ label: 'Used up', tone: 'muted' }]
  if (status.state === 'expired') {
    const unused = status.unused
    const label =
      pass.passType !== 'membership' && unused !== null && unused > 0
        ? `Expired – ${unused} unused`
        : 'Expired'
    return [{ label, tone: 'muted' }]
  }
  const badges: Badge[] = []
  if (status.state === 'frozen') badges.push({ label: 'Frozen', tone: 'info' })
  if (status.expiringSoon) badges.push({ label: 'Expiring soon', tone: 'warn' })
  if (status.low) badges.push({ label: 'Low', tone: 'warn' })
  return badges
}

const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

/** What a reminder says about its pass, without the pass's name. */
export function reminderText(reminder: Reminder): string {
  if (reminder.kind === 'low') return `${entries(reminder.entriesLeft as number)} left`
  if (reminder.kind === 'reset') {
    const left = entries(reminder.entriesLeft as number)
    return `${left} ${left.startsWith('1 ') ? 'resets' : 'reset'} ${relativeDays(reminder.daysToReset as number)}`
  }
  const left = reminder.entriesLeft === null ? '' : `, ${entries(reminder.entriesLeft)} left`
  return `expires ${relativeDays(reminder.daysLeft as number)}${left}`
}

/**
 * The words of a reminder banner (FR-31, FR-32, FR-59). `label` names the pass, "Gym, Type", since
 * one gym can have several. For example "Fitbloc, Multipass: expires in 3 days, 5 entries left".
 */
export function reminderMessage(reminder: Reminder, label: string): string {
  return `${label}: ${reminderText(reminder)}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * What importing a backup would do (or just did), one plain line each. Empty when it would change
 * nothing a person can see.
 */
export function importLines(summary: ImportSummary): string[] {
  const lines: string[] = []
  if (summary.passesAdded) lines.push(`${plural(summary.passesAdded, 'new pass', 'new passes')}`)
  if (summary.passesUpdated) {
    lines.push(
      `${plural(summary.passesUpdated, 'pass', 'passes')} updated (the backup has a newer edit)`,
    )
  }
  if (summary.passesRemoved) {
    lines.push(
      `${plural(summary.passesRemoved, 'pass', 'passes')} removed (deleted after the last change here)`,
    )
  }
  if (summary.usesAdded) {
    lines.push(`${plural(summary.usesAdded, 'recorded use', 'recorded uses')} added`)
  }
  if (summary.usesRemoved) {
    lines.push(`${plural(summary.usesRemoved, 'recorded use', 'recorded uses')} taken back`)
  }
  if (summary.freezesChanged) {
    lines.push(`${plural(summary.freezesChanged, 'freeze', 'freezes')} changed`)
  }
  if (summary.gymsAdded) lines.push(`${plural(summary.gymsAdded, 'new gym', 'new gyms')}`)
  if (summary.settings === 'added' || summary.settings === 'updated') {
    lines.push('Reminder settings from the backup')
  }
  return lines
}
