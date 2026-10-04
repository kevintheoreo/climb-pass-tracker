import { dateToNumber, type LocalDate } from './dates'
import { getPassStatus } from './passStatus'
import type { Settings } from './settings'
import type { PassBundle } from './types'

export type ReminderKind = 'expiring' | 'low' | 'reset'

export interface Reminder {
  /** Stable key used to remember dismissals. */
  key: string
  kind: ReminderKind
  passId: string
  /** The day the reminder was worked out for, so its "in 2 months" is counted from then. */
  today: LocalDate
  daysLeft: number | null
  entriesLeft: number | null
  /** The tightest reminder window reached, in days ("expiring" only). */
  window: number | null
  /** The date a monthly allowance next resets, and how far away it is ("reset" only). */
  resetDate: LocalDate | null
  daysToReset: number | null
}

export function reminderKey(passId: string, kind: ReminderKind): string {
  return `${passId}:${kind}`
}

/**
 * The value to store in `Settings.dismissedReminders` when the user dismisses this reminder:
 * the window for "expiring", the entries left for "low", the reset date as `YYYYMMDD` for "reset".
 */
export function dismissalValue(reminder: Reminder): number {
  if (reminder.kind === 'expiring') return reminder.window as number
  if (reminder.kind === 'low') return reminder.entriesLeft as number
  return dateToNumber(reminder.resetDate as LocalDate)
}

/**
 * Banners to show on the main screen (FR-31 to FR-34, FR-59).
 *
 * - Expiring: an active pass (or membership) whose days left is inside a reminder window. The
 *   "window" is the smallest configured number of days that still covers it.
 * - Low: an active counted pass with entries left at or under the threshold. Never for a monthly
 *   membership (D34).
 * - Reset: an active membership with a monthly allowance, entries left, and its next reset within
 *   the shortest reminder window (default 3 days) and on or before its end date (D34).
 * - Dismissed banners come back only once things get worse: a tighter expiry window is reached,
 *   or fewer entries are left than when it was dismissed. A dismissed reset banner stays hidden
 *   until the next period's reset comes around.
 * - Frozen, used-up and expired passes never produce reminders.
 *
 * Sorted with expiring banners first (soonest first), then resets (soonest first), then low ones
 * (fewest entries first).
 */
export function getReminders(
  bundles: PassBundle[],
  settings: Settings,
  today: LocalDate,
): Reminder[] {
  const windows = [...settings.expiryReminderDays].sort((a, b) => a - b)
  const reminders: Reminder[] = []

  for (const { pass, uses, freezes } of bundles) {
    if (pass.deletedAt !== null) continue
    const status = getPassStatus(pass, uses, freezes, today, settings)
    if (status.state !== 'active') continue

    const base = {
      passId: pass.id,
      today,
      daysLeft: status.daysLeft,
      entriesLeft: status.entriesLeft,
      window: null,
      resetDate: null,
      daysToReset: null,
    }

    if (settings.expiryRemindersEnabled && status.daysLeft !== null) {
      const window = windows.find((w) => status.daysLeft! <= w)
      if (window !== undefined) {
        const key = reminderKey(pass.id, 'expiring')
        const dismissed = settings.dismissedReminders[key]
        if (dismissed === undefined || window < dismissed) {
          reminders.push({ ...base, key, kind: 'expiring', window })
        }
      }
    }

    if (
      settings.resetRemindersEnabled &&
      status.nextReset !== null &&
      status.daysToReset !== null &&
      (status.entriesLeft ?? 0) > 0 &&
      windows.length > 0 &&
      status.daysToReset <= windows[0]! &&
      (status.daysLeft === null || status.daysToReset <= status.daysLeft)
    ) {
      const key = reminderKey(pass.id, 'reset')
      if (settings.dismissedReminders[key] !== dateToNumber(status.nextReset)) {
        reminders.push({
          ...base,
          key,
          kind: 'reset',
          resetDate: status.nextReset,
          daysToReset: status.daysToReset,
        })
      }
    }

    if (settings.lowRemindersEnabled && status.low) {
      const key = reminderKey(pass.id, 'low')
      const dismissed = settings.dismissedReminders[key]
      if (dismissed === undefined || status.entriesLeft! < dismissed) {
        reminders.push({ ...base, key, kind: 'low' })
      }
    }
  }

  const rank = { expiring: 0, reset: 1, low: 2 } as const
  const order = (r: Reminder) =>
    r.kind === 'expiring' ? r.daysLeft! : r.kind === 'reset' ? r.daysToReset! : r.entriesLeft!
  return reminders.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || order(a) - order(b) || (a.key < b.key ? -1 : 1),
  )
}

/** All the reminders about one pass, and the ones worth showing in its banner. */
export interface ReminderGroup {
  passId: string
  /** Every reminder about the pass: dismissing the banner dismisses all of them. */
  all: Reminder[]
  /** What the banner says. A "low" reminder is left out when "expiring" already mentions it. */
  shown: Reminder[]
}

/**
 * One banner per pass, not one per reminder: a pass that is both expiring and low says so once
 * ("expires in 10 days, 1 entry left"). Groups keep the order of the reminders they came from.
 */
export function groupByPass(reminders: Reminder[]): ReminderGroup[] {
  const groups = new Map<string, Reminder[]>()
  for (const reminder of reminders) {
    const list = groups.get(reminder.passId)
    if (list) list.push(reminder)
    else groups.set(reminder.passId, [reminder])
  }
  return [...groups].map(([passId, all]) => ({
    passId,
    all,
    shown: all.some((r) => r.kind === 'expiring') ? all.filter((r) => r.kind !== 'low') : all,
  }))
}
