import type { LocalDate } from './dates'
import { PASS_TYPE_LABELS } from './labels'
import { getPassStatus, lastValidDate, type PassStatus } from './passStatus'
import type { Settings } from './settings'
import type { GymRef, Pass, PassBundle } from './types'

/** One row of the main screen: a pass with everything the screen shows about it. */
export interface Row {
  bundle: PassBundle
  pass: Pass
  gym: GymRef
  gymName: string
  typeLabel: string
  status: PassStatus
  /** The last valid day (a membership's end date includes freezes), or null for no expiry. */
  expiry: LocalDate | null
}

export interface Rows {
  /** The main list, newest first by when the pass was added (D41). Includes frozen memberships. */
  active: Row[]
  /** Used-up and expired passes, for the collapsed Finished section (D27), in the same order. */
  finished: Row[]
}

type Thresholds = Pick<Settings, 'expiryReminderDays' | 'lowEntriesThreshold'>

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Newest first: the pass added to the app most recently is on top (D41). */
function byCreatedDescending(a: Row, b: Row): number {
  return compare(b.pass.createdAt, a.pass.createdAt) || compare(b.pass.id, a.pass.id)
}

/**
 * The main screen's content: every live pass as a row, split into the active list and the
 * Finished section. Passes are never grouped or merged by gym (D23).
 */
export function buildRows(
  bundles: PassBundle[],
  gymName: (ref: GymRef) => string,
  today: LocalDate,
  settings: Thresholds,
): Rows {
  const rows = bundles
    .filter(({ pass }) => pass.deletedAt === null)
    .map((bundle): Row => {
      const { pass, uses, freezes } = bundle
      return {
        bundle,
        pass,
        gym: pass.gymRef,
        gymName: gymName(pass.gymRef),
        typeLabel: PASS_TYPE_LABELS[pass.passType],
        status: getPassStatus(pass, uses, freezes, today, settings),
        expiry: lastValidDate(pass, freezes),
      }
    })

  return {
    active: rows.filter((r) => r.status.isActive).sort(byCreatedDescending),
    finished: rows.filter((r) => !r.status.isActive).sort(byCreatedDescending),
  }
}
