import { entriesLeft, getPassStatus } from './passStatus'
import type { LocalDate } from './dates'
import type { Settings } from './settings'
import { isCounted, type CountedPass, type PassBundle } from './types'

type Thresholds = Pick<Settings, 'expiryReminderDays' | 'lowEntriesThreshold'>

/**
 * Counted passes that can take a use today, in the order they should be offered (D6): soonest
 * expiry first. Ties go to the pass with fewer entries left (finish nearly-empty packs first), then
 * the earlier purchase, then creation time and id so the order is stable. Pass in the bundles for
 * one gym; the first result is pre-selected and the rest are the one-tap alternatives.
 */
export function orderUsablePasses(
  bundles: PassBundle[],
  today: LocalDate,
  settings: Thresholds,
): PassBundle[] {
  return bundles
    .filter(({ pass, uses, freezes }) => {
      if (pass.deletedAt !== null || !isCounted(pass)) return false
      const status = getPassStatus(pass, uses, freezes, today, settings)
      return status.state === 'active' && pass.purchaseDate <= today
    })
    .sort((a, b) => {
      const pa = a.pass as CountedPass
      const pb = b.pass as CountedPass
      if (pa.expiryDate !== pb.expiryDate) return pa.expiryDate < pb.expiryDate ? -1 : 1
      const diff = entriesLeft(pa, a.uses) - entriesLeft(pb, b.uses)
      if (diff !== 0) return diff
      if (pa.purchaseDate !== pb.purchaseDate) return pa.purchaseDate < pb.purchaseDate ? -1 : 1
      if (pa.createdAt !== pb.createdAt) return pa.createdAt < pb.createdAt ? -1 : 1
      return pa.id < pb.id ? -1 : 1
    })
}

/** The pass to pre-select for "Use 1", or null if the gym has no usable counted pass. */
export function preselectPass(
  bundles: PassBundle[],
  today: LocalDate,
  settings: Thresholds,
): PassBundle | null {
  return orderUsablePasses(bundles, today, settings)[0] ?? null
}
