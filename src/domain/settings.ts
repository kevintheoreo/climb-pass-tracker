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
