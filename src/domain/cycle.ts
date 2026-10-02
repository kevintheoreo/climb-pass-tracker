import { daysBetween, localDateOfTimestamp, type LocalDate } from './dates'
import type { MembershipPass, MonthlyMembership, Use } from './types'

/**
 * Monthly periods for a membership with an entries-per-month allowance (D32, D33).
 *
 * A period starts on a reset date and lasts until the next one. The reset day is the pass's
 * `resetDay`, or the day of its purchase date when none is set; in a month without that day the
 * reset falls on the month's last day. The first period starts on the purchase date and gets the
 * full allowance even if it is shorter than a month. Nothing is stored or reset by a timer: the
 * count is always worked out from the timestamped uses.
 */

export interface Period {
  /** First day of the period (inclusive). */
  start: LocalDate
  /** The next reset date: the first day of the following period. */
  nextReset: LocalDate
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')
const ymd = (year: number, month: number, day: number): LocalDate =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`

function parts(date: LocalDate) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The reset date in a given month (month 1 to 12), clamped to the month's last day. */
export function resetDateIn(year: number, month: number, resetDay: number): LocalDate {
  return ymd(year, month, Math.min(resetDay, daysInMonth(year, month)))
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** The day of the month the count resets: the pass's own setting, else its purchase day. */
export function resetDayOf(pass: MembershipPass): number {
  return pass.resetDay ?? parts(pass.purchaseDate).day
}

/** The period that `today` falls in. Before the purchase date it is the first period. */
export function currentPeriod(pass: MembershipPass, today: LocalDate): Period {
  const resetDay = resetDayOf(pass)
  const ref = today < pass.purchaseDate ? pass.purchaseDate : today
  const { year, month } = parts(ref)
  const thisMonth = resetDateIn(year, month, resetDay)

  let start: LocalDate
  let nextReset: LocalDate
  if (thisMonth <= ref) {
    const next = shiftMonth(year, month, 1)
    start = thisMonth
    nextReset = resetDateIn(next.year, next.month, resetDay)
  } else {
    const prev = shiftMonth(year, month, -1)
    start = resetDateIn(prev.year, prev.month, resetDay)
    nextReset = thisMonth
  }
  return { start: start < pass.purchaseDate ? pass.purchaseDate : start, nextReset }
}

/** The live uses of this pass that fall inside the period. */
export function usesInPeriod(pass: MembershipPass, uses: Use[], period: Period): Use[] {
  return uses.filter((use) => {
    if (use.deletedAt !== null || use.passId !== pass.id) return false
    const day = localDateOfTimestamp(use.usedAt)
    return day >= period.start && day < period.nextReset
  })
}

/** Entries left this period, never below 0. */
export function monthlyEntriesLeft(pass: MonthlyMembership, uses: Use[], today: LocalDate): number {
  const used = usesInPeriod(pass, uses, currentPeriod(pass, today)).length
  return Math.max(0, pass.monthlyEntries - used)
}

export function daysUntilReset(pass: MembershipPass, today: LocalDate): number {
  return daysBetween(today, currentPeriod(pass, today).nextReset)
}
