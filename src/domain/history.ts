import { currentPeriod, usesInPeriod } from './cycle'
import { localDateOfTimestamp, type LocalDate } from './dates'
import { PASS_TYPE_LABELS } from './labels'
import { lastValidDate } from './passStatus'
import { isMonthly, type Freeze, type GymRef, type Pass, type PassBundle, type Use } from './types'

/** One line of the usage history: one recorded use of one pass (D58). */
export interface HistoryEntry {
  use: Use
  pass: Pass
  gymName: string
  typeLabel: string
  /** The local date of the use. */
  date: LocalDate
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Every live use of every live pass, newest first (by when it was used, then by when it was
 * recorded). Uses that `+` took back, and the uses of deleted passes, are not in it. Entries counted
 * as "already used" when a pass was added have no use record, so they are not in it either.
 */
export function buildHistory(
  bundles: PassBundle[],
  gymName: (ref: GymRef) => string,
): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const { pass, uses } of bundles) {
    if (pass.deletedAt !== null) continue
    for (const use of uses) {
      if (use.deletedAt !== null || use.passId !== pass.id) continue
      entries.push({
        use,
        pass,
        gymName: gymName(pass.gymRef),
        typeLabel: PASS_TYPE_LABELS[pass.passType],
        date: localDateOfTimestamp(use.usedAt),
      })
    }
  }
  return entries.sort(
    (a, b) =>
      compare(b.use.usedAt, a.use.usedAt) ||
      compare(b.use.createdAt, a.use.createdAt) ||
      compare(b.use.id, a.use.id),
  )
}

/** Why a new date for a recorded use is refused (D58). */
export type UseDateProblem =
  | { reason: 'invalid_date' }
  | { reason: 'before_purchase'; purchaseDate: LocalDate }
  | { reason: 'in_future' }
  | { reason: 'after_end'; lastDate: LocalDate }
  | { reason: 'month_full'; allowance: number; periodStart: LocalDate; nextReset: LocalDate }

export type UseDateCheck = { ok: true } | ({ ok: false } & UseDateProblem)

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` and a day that exists: 30 February is not one (the Date constructor would roll it over). */
function isRealDate(date: string): boolean {
  if (!DATE.test(date)) return false
  const parsed = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
  )
  return parsed.toISOString().slice(0, 10) === date
}

/**
 * Whether a recorded use may be moved to `newDate` (D58). The date has to be a real date between
 * the pass's purchase date and today, and not after the last day the pass is valid. For a monthly
 * membership the month it moves into must not end up with more uses than the monthly allowance, so
 * "entries left" can never go below 0. `uses` are the pass's uses, `use` one of them.
 */
export function checkUseDate(
  pass: Pass,
  use: Use,
  uses: Use[],
  freezes: Freeze[],
  newDate: LocalDate,
  today: LocalDate,
): UseDateCheck {
  if (!isRealDate(newDate)) return { ok: false, reason: 'invalid_date' }
  if (newDate < pass.purchaseDate) {
    return { ok: false, reason: 'before_purchase', purchaseDate: pass.purchaseDate }
  }
  if (newDate > today) return { ok: false, reason: 'in_future' }
  const lastDate = lastValidDate(pass, freezes)
  if (lastDate !== null && newDate > lastDate) return { ok: false, reason: 'after_end', lastDate }

  if (isMonthly(pass)) {
    const period = currentPeriod(pass, newDate)
    const others = uses.filter((u) => u.id !== use.id)
    if (usesInPeriod(pass, others, period).length >= pass.monthlyEntries) {
      return {
        ok: false,
        reason: 'month_full',
        allowance: pass.monthlyEntries,
        periodStart: period.start,
        nextReset: period.nextReset,
      }
    }
  }
  return { ok: true }
}
