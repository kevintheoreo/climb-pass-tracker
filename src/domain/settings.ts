export interface Settings {
  /** Days-before-expiry windows that trigger an "expiring soon" reminder. */
  expiryReminderDays: number[]
  /** A counted pass with this many entries left or fewer triggers a "low" reminder. */
  lowEntriesThreshold: number
  expiryRemindersEnabled: boolean
  lowRemindersEnabled: boolean
  /** "Entries reset soon" reminder for memberships with a monthly allowance (D34). */
  resetRemindersEnabled: boolean
  /**
   * Dismissed reminders, keyed by `reminderKey()`. The value is the state at dismissal: the window
   * (days) for "expiring", the entries left for "low", the reset date as `YYYYMMDD` for "reset".
   * A reminder returns once it gets worse (or, for "reset", once the next period starts).
   */
  dismissedReminders: Record<string, number>
}

export const DEFAULT_SETTINGS: Settings = {
  expiryReminderDays: [14, 3],
  lowEntriesThreshold: 2,
  expiryRemindersEnabled: true,
  lowRemindersEnabled: true,
  resetRemindersEnabled: true,
  dismissedReminders: {},
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const DAYS_HELP = 'Enter up to 5 numbers of days from 1 to 365, like 14, 3'

/** The "remind me this many days before" box: `14, 3` → `[14, 3]`. Biggest first, no repeats. */
export function parseReminderDays(text: string): Parsed<number[]> {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0)
    return { ok: false, error: 'Enter at least one number of days, like 14, 3' }
  const days = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))
  if (days.some((d) => !(d >= 1 && d <= 365))) return { ok: false, error: DAYS_HELP }
  const unique = [...new Set(days)].sort((a, b) => b - a)
  if (unique.length > 5) return { ok: false, error: DAYS_HELP }
  return { ok: true, value: unique }
}

/** The "low entries" box: a whole number from 1 to 100. */
export function parseLowThreshold(text: string): Parsed<number> {
  const t = text.trim()
  const n = /^\d+$/.test(t) ? Number(t) : NaN
  if (!(n >= 1 && n <= 100)) return { ok: false, error: 'Enter a number from 1 to 100' }
  return { ok: true, value: n }
}
