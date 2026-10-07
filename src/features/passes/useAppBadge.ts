import { useEffect } from 'react'

/** The two Badging API calls, which TypeScript's DOM types do not include everywhere yet. */
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Shows the number of reminder banners on the app's icon (FR-35), where the browser supports it
 * (installed app on Android, desktop Chrome and Edge, and iPhone 16.4+ when notifications are
 * allowed for the app). Zero clears the badge. It is set while the app is open and stays as it was
 * when the app is closed; nothing runs in the background. `count` is null while the rows load, so
 * the badge is left alone until the real number is known. Failures are ignored: the badge is only
 * a convenience.
 */
export function useAppBadge(count: number | null): void {
  useEffect(() => {
    if (count === null) return
    const nav = navigator as BadgeNavigator
    const result = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
    result?.catch(() => {})
  }, [count])
}
