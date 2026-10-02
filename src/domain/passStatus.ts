import { currentPeriod, monthlyEntriesLeft } from './cycle'
import { addDays, daysBetween, type LocalDate } from './dates'
import type { Settings } from './settings'
import {
  isCounted,
  isMembership,
  isMonthly,
  type Freeze,
  type MembershipPass,
  type Pass,
  type Use,
} from './types'

const live = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null)

/**
 * Entries left. Multipass, class pack and single entry: total − already used − recorded uses.
 * Membership with a monthly allowance: the allowance minus this period's uses. Unlimited
 * membership: null. Never negative, even if the total is later edited below the recorded uses.
 */
export function entriesLeft(pass: Pass, uses: Use[], today: LocalDate): number | null {
  if (isMonthly(pass)) return monthlyEntriesLeft(pass, uses, today)
  if (isMembership(pass)) return null
  const logged = live(uses).filter((u) => u.passId === pass.id).length
  return Math.max(0, pass.totalEntries - pass.initialUsed - logged)
}

/** The most entries the counter can show: the total, or the monthly allowance. */
export function entriesTotal(pass: Pass): number | null {
  if (isMonthly(pass)) return pass.monthlyEntries
  if (isMembership(pass)) return null
  return pass.totalEntries
}

/** Inclusive length in days of a date range (a single day is 1 day). */
function inclusiveDays(start: LocalDate, end: LocalDate): number {
  return daysBetween(start, end) + 1
}

/**
 * Membership end date once freezes are added. Freezes extend the end by their length in days.
 * Overlapping freezes are merged so a day is never counted twice, and a freeze that begins after
 * the (already extended) membership has ended, or ended before it started, is ignored.
 */
export function effectiveEndDate(pass: MembershipPass, freezes: Freeze[]): LocalDate {
  const intervals = live(freezes)
    .filter(
      (f) => f.passId === pass.id && f.endDate >= f.startDate && f.endDate >= pass.purchaseDate,
    )
    .map((f) => ({ start: f.startDate, end: f.endDate }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))

  const merged: { start: LocalDate; end: LocalDate }[] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= addDays(last.end, 1)) {
      if (interval.end > last.end) last.end = interval.end
    } else {
      merged.push({ ...interval })
    }
  }

  let end = pass.expiryDate
  for (const m of merged) {
    if (m.start > end) continue
    end = addDays(end, inclusiveDays(m.start, m.end))
  }
  return end
}

export function isFrozenOn(date: LocalDate, pass: Pass, freezes: Freeze[]): boolean {
  return live(freezes).some((f) => f.passId === pass.id && f.startDate <= date && date <= f.endDate)
}

/** The last day the pass can be used, or null for a single entry with no expiry. */
export function lastValidDate(pass: Pass, freezes: Freeze[]): LocalDate | null {
  return isCounted(pass) ? pass.expiryDate : effectiveEndDate(pass, freezes)
}

/**
 * Days until the last valid day. 0 on that day itself (a pass is usable through its expiry date),
 * negative once it has passed. Null when there is no expiry.
 */
export function daysLeft(pass: Pass, freezes: Freeze[], today: LocalDate): number | null {
  const last = lastValidDate(pass, freezes)
  return last === null ? null : daysBetween(today, last)
}

/** True once the last valid day has gone by. */
export function isPastEnd(pass: Pass, freezes: Freeze[], today: LocalDate): boolean {
  const days = daysLeft(pass, freezes, today)
  return days !== null && days < 0
}

export type PassState = 'active' | 'used_up' | 'expired' | 'frozen'

export interface PassStatus {
  /** Main status shown on the badge. */
  state: PassState
  /** True when the pass is listed in the main list rather than in Finished. */
  isActive: boolean
  /** Null for an unlimited membership. */
  entriesLeft: number | null
  /** The total, or the monthly allowance. Null for an unlimited membership. */
  total: number | null
  /** Entries wasted because the pass expired. Counted passes only; otherwise null. */
  unused: number | null
  daysLeft: number | null
  /** Monthly memberships only: the date the count next resets, and how many days away that is. */
  nextReset: LocalDate | null
  daysToReset: number | null
  /** Extra badges; only ever true while the pass is `active`. */
  expiringSoon: boolean
  /** Never true for a monthly membership (D34) or a single entry. */
  low: boolean
}

type Thresholds = Pick<Settings, 'expiryReminderDays' | 'lowEntriesThreshold'>

/** The widest reminder window in days, i.e. when a pass first counts as "expiring soon". */
export function expiringSoonDays(settings: Pick<Settings, 'expiryReminderDays'>): number {
  return settings.expiryReminderDays.length ? Math.max(...settings.expiryReminderDays) : 0
}

/**
 * The single source of truth for what state a pass is in. Order of precedence:
 * counted: used up → expired → active; membership: expired → frozen → active.
 * A monthly membership is never used up: at 0 it stays active until the next reset.
 * Badge flags use the reminder thresholds but ignore the reminders on/off switches, which only
 * control banners.
 */
export function getPassStatus(
  pass: Pass,
  uses: Use[],
  freezes: Freeze[],
  today: LocalDate,
  settings: Thresholds,
): PassStatus {
  const left = entriesLeft(pass, uses, today)
  const days = daysLeft(pass, freezes, today)
  const expired = days !== null && days < 0
  const soon = days !== null && days <= expiringSoonDays(settings)

  const period = isMonthly(pass) ? currentPeriod(pass, today) : null
  const base: PassStatus = {
    state: 'active',
    isActive: true,
    entriesLeft: left,
    total: entriesTotal(pass),
    unused: null,
    daysLeft: days,
    nextReset: period?.nextReset ?? null,
    daysToReset: period ? daysBetween(today, period.nextReset) : null,
    expiringSoon: false,
    low: false,
  }

  if (isCounted(pass)) {
    if (left === 0) return { ...base, state: 'used_up', isActive: false, unused: 0 }
    if (expired) return { ...base, state: 'expired', isActive: false, unused: left }
    // A single entry has just the one entry, so "low" would always be true and tells nothing.
    const low = pass.passType !== 'single_entry' && (left ?? 0) <= settings.lowEntriesThreshold
    return { ...base, expiringSoon: soon, low }
  }

  if (expired)
    return { ...base, state: 'expired', isActive: false, nextReset: null, daysToReset: null }
  if (isFrozenOn(today, pass, freezes)) return { ...base, state: 'frozen' }
  return { ...base, expiringSoon: soon }
}
