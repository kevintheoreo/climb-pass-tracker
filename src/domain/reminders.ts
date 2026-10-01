import type { LocalDate } from './dates'
import { getPassStatus } from './passStatus'
import type { Settings } from './settings'
import { isCounted, type PassBundle } from './types'

export type ReminderKind = 'expiring' | 'low'

export interface Reminder {
  /** Stable key used to remember dismissals. */
  key: string
  kind: ReminderKind
  passId: string
  daysLeft: number | null
  entriesLeft: number | null
  /** The tightest reminder window reached, in days ("expiring" only). */
  window: number | null
}

export function reminderKey(passId: string, kind: ReminderKind): string {
  return `${passId}:${kind}`
}

/** The value to store in `Settings.dismissedReminders` when the user dismisses this reminder. */
export function dismissalValue(reminder: Reminder): number {
  return (reminder.kind === 'expiring' ? reminder.window : reminder.entriesLeft) as number
}

/**
 * Banners to show on the dashboard (FR-31 to FR-34).
 *
 * - Expiring: an active pass with entries left (or a membership) whose days left is inside a
 *   reminder window. The "window" is the smallest configured number of days that still covers it.
 * - Low: an active counted pass with entries left at or under the threshold.
 * - Dismissed banners come back only once things get worse: a tighter expiry window is reached, or
 *   fewer entries are left than when it was dismissed.
 * - Frozen, used-up, expired and single-entry passes never produce reminders.
 *
 * Sorted with expiring banners first (soonest first), then low ones (fewest entries first).
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

    if (settings.expiryRemindersEnabled && status.daysLeft !== null) {
      const window = windows.find((w) => status.daysLeft! <= w)
      if (window !== undefined) {
        const key = reminderKey(pass.id, 'expiring')
        const dismissed = settings.dismissedReminders[key]
        if (dismissed === undefined || window < dismissed) {
          reminders.push({
            key,
            kind: 'expiring',
            passId: pass.id,
            daysLeft: status.daysLeft,
            entriesLeft: status.entriesLeft,
            window,
          })
        }
      }
    }

    if (settings.lowRemindersEnabled && isCounted(pass) && status.low) {
      const key = reminderKey(pass.id, 'low')
      const dismissed = settings.dismissedReminders[key]
      if (dismissed === undefined || status.entriesLeft! < dismissed) {
        reminders.push({
          key,
          kind: 'low',
          passId: pass.id,
          daysLeft: status.daysLeft,
          entriesLeft: status.entriesLeft,
          window: null,
        })
      }
    }
  }

  const rank = (r: Reminder) => (r.kind === 'expiring' ? 0 : 1)
  return reminders.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.kind === 'expiring' ? a.daysLeft! - b.daysLeft! : a.entriesLeft! - b.entriesLeft!) ||
      (a.key < b.key ? -1 : 1),
  )
}
