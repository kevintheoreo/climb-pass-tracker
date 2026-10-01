import { addDays, daysBetween, type LocalDate } from './dates'
import type { Settings } from './settings'
import {
  isCounted,
  isMembership,
  type CountedPass,
  type Freeze,
  type MembershipPass,
  type Pass,
  type Use,
} from './types'

const live = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null)

/**
 * Entries left on a counted pass: total − already used − logged uses. Never negative, even if the
 * total is later edited below the number of recorded uses.
 */
export function entriesLeft(pass: CountedPass, uses: Use[]): number {
  const logged = live(uses).filter((u) => u.passId === pass.id).length
  return Math.max(0, pass.totalEntries - pass.initialUsed - logged)
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
    .filter((f) => f.passId === pass.id && f.endDate >= f.startDate && f.endDate >= pass.startDate)
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

  let end = pass.endDate
  for (const m of merged) {
    if (m.start > end) continue
    end = addDays(end, inclusiveDays(m.start, m.end))
  }
  return end
}

export function isFrozenOn(date: LocalDate, pass: Pass, freezes: Freeze[]): boolean {
  return live(freezes).some((f) => f.passId === pass.id && f.startDate <= date && date <= f.endDate)
}

/** The last day a counted pass or membership can be used, or null for a single entry. */
export function lastValidDate(pass: Pass, freezes: Freeze[]): LocalDate | null {
  if (isCounted(pass)) return pass.expiryDate
  if (isMembership(pass)) return effectiveEndDate(pass, freezes)
  return null
}

/**
 * Days until the last valid day. 0 on that day itself (a pass is usable through its expiry date),
 * negative once it has passed. Null for a single entry.
 */
export function daysLeft(pass: Pass, freezes: Freeze[], today: LocalDate): number | null {
  const last = lastValidDate(pass, freezes)
  return last === null ? null : daysBetween(today, last)
}

export type PassState = 'active' | 'used_up' | 'expired' | 'frozen' | 'visit'

export interface PassStatus {
  /** Main status shown on the badge. */
  state: PassState
  /** True when the pass belongs on the dashboard rather than in History. */
  isActive: boolean
  /** Counted passes only. */
  entriesLeft: number | null
  /** Counted passes only: entries wasted because the pass expired. Otherwise null. */
  unused: number | null
  daysLeft: number | null
  /** Extra badges; only ever true while the pass is `active`. */
  expiringSoon: boolean
  low: boolean
}

type ReminderThresholds = Pick<Settings, 'expiryReminderDays' | 'lowEntriesThreshold'>

/** The widest reminder window in days, i.e. when a pass first counts as "expiring soon". */
export function expiringSoonDays(settings: Pick<Settings, 'expiryReminderDays'>): number {
  return settings.expiryReminderDays.length ? Math.max(...settings.expiryReminderDays) : 0
}

/**
 * The single source of truth for what state a pass is in. Order of precedence:
 * counted: used up → expired → active; membership: expired → frozen → active; single entry: visit.
 * Badge flags use the reminder thresholds but ignore the reminders on/off switches, which only
 * control banners.
 */
export function getPassStatus(
  pass: Pass,
  uses: Use[],
  freezes: Freeze[],
  today: LocalDate,
  settings: ReminderThresholds,
): PassStatus {
  const base: PassStatus = {
    state: 'active',
    isActive: true,
    entriesLeft: null,
    unused: null,
    daysLeft: daysLeft(pass, freezes, today),
    expiringSoon: false,
    low: false,
  }

  if (isCounted(pass)) {
    const left = entriesLeft(pass, uses)
    const days = base.daysLeft as number
    if (left === 0) {
      return { ...base, state: 'used_up', isActive: false, entriesLeft: 0, unused: 0 }
    }
    if (days < 0) {
      return { ...base, state: 'expired', isActive: false, entriesLeft: left, unused: left }
    }
    return {
      ...base,
      entriesLeft: left,
      expiringSoon: days <= expiringSoonDays(settings),
      low: left <= settings.lowEntriesThreshold,
    }
  }

  if (isMembership(pass)) {
    const days = base.daysLeft as number
    if (days < 0) return { ...base, state: 'expired', isActive: false }
    if (isFrozenOn(today, pass, freezes)) return { ...base, state: 'frozen' }
    return { ...base, expiringSoon: days <= expiringSoonDays(settings) }
  }

  return { ...base, state: 'visit', isActive: false }
}
