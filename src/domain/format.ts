import {
  addDays,
  addMonthsToDate,
  daysBetween,
  formatDate,
  formatDayMonth,
  type LocalDate,
} from './dates'
import type { PassStatus } from './passStatus'
import type { ImportSummary } from './backup'
import { formatSgd } from './money'
import type { Reminder } from './reminders'
import type { Pass } from './types'

const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Whole calendar months from `from` to `to` (`from` is not after `to`). */
function wholeMonths(from: LocalDate, to: LocalDate): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  let months = (ty - fy) * 12 + (tm - fm)
  while (months > 0 && addMonthsToDate(from, months) > to) months--
  return months
}

/**
 * A stretch of time in the units a person thinks in (D43): days up to a month, then months and
 * days, months alone from 6 months, and years and months from a year. "45 days" is "1 month 14
 * days"; 200 days is "6 months"; 400 days is "1 year 1 month". The date is shown next to it, so
 * the small remainder is left out once it stops mattering.
 */
function spanText(from: LocalDate, to: LocalDate): string {
  const months = wholeMonths(from, to)
  const days = daysBetween(addMonthsToDate(from, months), to)
  if (months === 0) return unit(days, 'day', 'days')
  const years = Math.floor(months / 12)
  if (years >= 1) {
    const rest = months % 12
    return rest === 0
      ? unit(years, 'year', 'years')
      : `${unit(years, 'year', 'years')} ${unit(rest, 'month', 'months')}`
  }
  if (months < 6 && days > 0)
    return `${unit(months, 'month', 'months')} ${unit(days, 'day', 'days')}`
  return unit(months, 'month', 'months')
}

/**
 * How far away a date is, from `today`: "today", "tomorrow", "in 12 days", "in 2 months 5 days",
 * "in 6 months", "in 1 year 3 months", "yesterday", "10 days ago". `days` is the distance in days.
 */
export function relativeTime(days: number, today: LocalDate): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  const target = addDays(today, days)
  return days > 0 ? `in ${spanText(today, target)}` : `${spanText(target, today)} ago`
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

/**
 * "S$12.00 each": what one entry cost, for splitting the cost with a friend who uses the pass
 * (D44). Only for a pass that has a price and more than one entry: a single entry's cost is its
 * price, and a membership has no fixed number of entries. Rounded to the nearest cent.
 */
export function pricePerEntryLabel(pass: Pass): string | null {
  if (pass.passType === 'membership' || pass.priceCents === null) return null
  if (pass.priceCents === 0 || pass.totalEntries < 2) return null
  return `${formatSgd(Math.round(pass.priceCents / pass.totalEntries))} each`
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
    return `${left} ${left.startsWith('1 ') ? 'resets' : 'reset'} ${relativeTime(reminder.daysToReset as number, reminder.today)}`
  }
  const left = reminder.entriesLeft === null ? '' : `, ${entries(reminder.entriesLeft)} left`
  return `expires ${relativeTime(reminder.daysLeft as number, reminder.today)}${left}`
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
