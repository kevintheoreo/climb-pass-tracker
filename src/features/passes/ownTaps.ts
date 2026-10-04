import type { Reminder } from '../../domain/reminders'

/**
 * A banner that appears above the list while the person is tapping `−` pushes every row down, so
 * the next tap lands on something else (D42). So a banner that the person's own taps on `−` / `+`
 * would bring in is held back for the rest of this visit: the row still shows its badge, and the
 * banner is there the next time the app is opened. Banners that were already showing when the app
 * was opened stay, and expiring banners (which taps cannot cause) are never held back.
 */

const tapped = new Set<string>()
let shownAtOpen: Set<string> | null = null

/** Call when the person taps `−` or `+` on a pass, before the change is saved. */
export function markTapped(passId: string) {
  tapped.add(passId)
}

/** The banners to show now: leaves out the ones caused by taps on `−` or `+` in this visit. */
export function withoutBannersFromOwnTaps(reminders: Reminder[]): Reminder[] {
  if (shownAtOpen === null) shownAtOpen = new Set(reminders.map((r) => r.key))
  const opened = shownAtOpen
  return reminders.filter(
    (r) => r.kind === 'expiring' || !tapped.has(r.passId) || opened.has(r.key),
  )
}

/** Forgets the taps and what was showing, as opening the app again does. For tests. */
export function forgetOwnTaps() {
  tapped.clear()
  shownAtOpen = null
}
