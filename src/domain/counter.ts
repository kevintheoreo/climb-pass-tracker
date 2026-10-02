import { currentPeriod, usesInPeriod } from './cycle'
import type { LocalDate } from './dates'
import { entriesLeft, isPastEnd } from './passStatus'
import { isCounted, isMonthly, type Freeze, type Pass, type Use } from './types'

/** Whether the row has `−` / `+` at all: everything except an unlimited membership. */
export function hasCounter(pass: Pass): boolean {
  return isCounted(pass) || isMonthly(pass)
}

export type UseBlockReason =
  | 'no_counter' // an unlimited membership
  | 'finished' // past its last valid day
  | 'none_left'

export type CanUseEntry = { ok: true } | { ok: false; reason: UseBlockReason }

/**
 * Whether `−` may use an entry today (D25, FR-9, FR-11, FR-12). A pass is usable through its whole
 * expiry date. At 0 left a monthly membership stays in the list and simply cannot be used until
 * the next reset.
 */
export function canUseEntry(
  pass: Pass,
  uses: Use[],
  freezes: Freeze[],
  today: LocalDate,
): CanUseEntry {
  if (!hasCounter(pass)) return { ok: false, reason: 'no_counter' }
  if (isPastEnd(pass, freezes, today)) return { ok: false, reason: 'finished' }
  if (entriesLeft(pass, uses, today) === 0) return { ok: false, reason: 'none_left' }
  return { ok: true }
}

export type GiveBackPlan =
  | { ok: true; action: 'remove_use'; useId: string }
  | { ok: true; action: 'lower_initial_used' }
  | { ok: false; reason: 'no_counter' | 'finished' | 'full' }

/** The most recently used entry first. */
function latest(uses: Use[]): Use | undefined {
  return [...uses].sort((a, b) =>
    a.usedAt !== b.usedAt
      ? a.usedAt < b.usedAt
        ? 1
        : -1
      : a.createdAt !== b.createdAt
        ? a.createdAt < b.createdAt
          ? 1
          : -1
        : a.id < b.id
          ? 1
          : -1,
  )[0]
}

/**
 * What `+` should do (FR-52): take back the most recent recorded use, or, for a counted pass with
 * no recorded uses, lower "already used". A monthly membership only looks at the current period,
 * so it can never go above its allowance. Expired rows are inert, but a used-up row can still give
 * its last entry back to undo a mis-tap.
 */
export function planGiveBack(
  pass: Pass,
  uses: Use[],
  freezes: Freeze[],
  today: LocalDate,
): GiveBackPlan {
  if (!hasCounter(pass)) return { ok: false, reason: 'no_counter' }
  if (isPastEnd(pass, freezes, today)) return { ok: false, reason: 'finished' }

  if (isMonthly(pass)) {
    const inPeriod = usesInPeriod(pass, uses, currentPeriod(pass, today))
    const last = latest(inPeriod)
    return last ? { ok: true, action: 'remove_use', useId: last.id } : { ok: false, reason: 'full' }
  }

  const mine = uses.filter((u) => u.deletedAt === null && u.passId === pass.id)
  const last = latest(mine)
  if (last) return { ok: true, action: 'remove_use', useId: last.id }
  if (isCounted(pass) && pass.initialUsed > 0) return { ok: true, action: 'lower_initial_used' }
  return { ok: false, reason: 'full' }
}

/** What a row's `−` / `+` buttons should look like right now. */
export interface CounterView {
  /** False for an unlimited membership and for an expired row, which are inert (FR-12, FR-50). */
  visible: boolean
  canUse: boolean
  canGiveBack: boolean
}

export function counterView(
  pass: Pass,
  uses: Use[],
  freezes: Freeze[],
  today: LocalDate,
): CounterView {
  const canUse = canUseEntry(pass, uses, freezes, today).ok
  const canGiveBack = planGiveBack(pass, uses, freezes, today).ok
  return { visible: hasCounter(pass) && (canUse || canGiveBack), canUse, canGiveBack }
}
