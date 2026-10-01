export interface Settings {
  /** Days-before-expiry windows that trigger an "expiring soon" reminder. */
  expiryReminderDays: number[]
  /** A counted pass with this many entries left or fewer triggers a "low" reminder. */
  lowEntriesThreshold: number
  expiryRemindersEnabled: boolean
  lowRemindersEnabled: boolean
  /**
   * Dismissed reminders, keyed by `reminderKey()`. The value is the state at dismissal: the window
   * (days) for "expiring", the entries left for "low". A reminder returns once it gets worse.
   */
  dismissedReminders: Record<string, number>
}

export const DEFAULT_SETTINGS: Settings = {
  expiryReminderDays: [14, 3],
  lowEntriesThreshold: 2,
  expiryRemindersEnabled: true,
  lowRemindersEnabled: true,
  dismissedReminders: {},
}
