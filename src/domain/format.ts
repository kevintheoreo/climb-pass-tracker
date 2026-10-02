import { formatDate, formatDayMonth, type LocalDate } from './dates'
import type { PassStatus } from './passStatus'
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
