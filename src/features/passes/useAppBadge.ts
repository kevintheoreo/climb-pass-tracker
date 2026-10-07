import { useEffect } from 'react'

/** The two Badging API calls, which TypeScript's DOM types do not include everywhere yet. */
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** What the last attempt to set the badge did, for the line in Settings. */
export interface BadgeReport {
  /** The number asked for (0 = clear). */
  count: number
  /** `ok`, or the browser's reason for refusing. */
  outcome: string
}

let lastReport: BadgeReport | null = null

/** Kept in memory only, so Settings can say what happened since the app was opened. */
export const lastBadgeReport = (): BadgeReport | null => lastReport

/** Does this browser have the Badging API at all? */
export const badgeSupported = (): boolean => 'setAppBadge' in navigator

/**
 * Shows the number of reminder banners on the app's icon (FR-35), where the browser supports it
 * (installed app on Android, desktop Chrome and Edge, and iPhone 16.4+ when notifications are
 * allowed for the app). Zero clears the badge. It is set while the app is open and stays as it was
 * when the app is closed; nothing runs in the background. `count` is null while the rows load, so
 * the badge is left alone until the real number is known. Failures are not shown to the person
 * (the badge is only a convenience); the last outcome is kept for the line in Settings.
 */
export function useAppBadge(count: number | null): void {
  useEffect(() => {
    if (count === null) return
    const nav = navigator as BadgeNavigator
    const result = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
    if (!result) return
    result.then(
      () => {
        lastReport = { count, outcome: 'ok' }
      },
      (failure: unknown) => {
        lastReport = {
          count,
          outcome: failure instanceof Error ? failure.message || failure.name : 'refused',
        }
      },
    )
  }, [count])
}
