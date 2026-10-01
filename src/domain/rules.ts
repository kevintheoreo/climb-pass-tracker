import { localDateOfTimestamp, type LocalDate } from './dates'
import { effectiveEndDate, entriesLeft, isFrozenOn } from './passStatus'
import { isCounted, isMembership, type Freeze, type Pass, type Use } from './types'

export type UseBlockReason =
  | 'single_entry' // single entries are recorded when created, not "used"
  | 'future_date'
  | 'before_start' // earlier than the purchase / start date
  | 'expired' // later than the expiry / end date
  | 'no_entries_left'

export type CanLogUse =
  | { ok: true; /** Membership visit logged during a freeze. */ frozen: boolean }
  | { ok: false; reason: UseBlockReason }

interface CanLogUseArgs {
  pass: Pass
  /**
   * The pass's existing uses. When editing a use's date, leave the use being edited out so the
   * entry count reflects the pass without it.
   */
  uses: Use[]
  freezes: Freeze[]
  /** The date the use is being logged for: today for a tap, an earlier date for a backdated use. */
  onDate: LocalDate
  today: LocalDate
}

/**
 * Whether a use (or membership visit) may be logged for `onDate`.
 * A pass is usable through the whole of its expiry date (so tapping on the expiry day works).
 */
export function canLogUse({ pass, uses, freezes, onDate, today }: CanLogUseArgs): CanLogUse {
  if (isCounted(pass)) {
    if (onDate > today) return { ok: false, reason: 'future_date' }
    if (onDate < pass.purchaseDate) return { ok: false, reason: 'before_start' }
    if (onDate > pass.expiryDate) return { ok: false, reason: 'expired' }
    if (entriesLeft(pass, uses) === 0) return { ok: false, reason: 'no_entries_left' }
    return { ok: true, frozen: false }
  }

  if (isMembership(pass)) {
    if (onDate > today) return { ok: false, reason: 'future_date' }
    if (onDate < pass.startDate) return { ok: false, reason: 'before_start' }
    if (onDate > effectiveEndDate(pass, freezes)) return { ok: false, reason: 'expired' }
    return { ok: true, frozen: isFrozenOn(onDate, pass, freezes) }
  }

  return { ok: false, reason: 'single_entry' }
}

/** Convenience for edit flows that start from a use's timestamp rather than a date. */
export function useDate(use: Pick<Use, 'usedAt'>): LocalDate {
  return localDateOfTimestamp(use.usedAt)
}
