/**
 * Installing the app and keeping its data (D40). Pure: the browser's facts are passed in, so this
 * is the same on every phone and can be tested without one.
 */

export type Platform = 'ios' | 'android' | 'other'

export interface PlatformFacts {
  userAgent: string
  /** `navigator.platform`: an iPad asking for the desktop site says "MacIntel". */
  platform: string
  maxTouchPoints: number
}

export function detectPlatform({ userAgent, platform, maxTouchPoints }: PlatformFacts): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  // An iPad that asks for desktop sites looks like a Mac, but a Mac has no touch screen.
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'other'
}

/**
 * How safe the person's data is from the browser deleting it:
 * - `installed`: running as an installed app, which browsers do not clean up behind the person's back
 * - `kept`: the browser has promised to keep this site's data
 * - `at-risk`: neither. Safari clears a site's data after about a week without a visit, and other
 *   browsers may clear it when the phone is short of space
 */
export type Protection = 'installed' | 'kept' | 'at-risk'

export function protectionOf({
  standalone,
  persisted,
}: {
  standalone: boolean
  persisted: boolean
}): Protection {
  if (standalone) return 'installed'
  return persisted ? 'kept' : 'at-risk'
}

/** Whether to offer to install: only when there is something to keep, and it is not installed. */
export function shouldOfferInstall({
  hasPasses,
  standalone,
  dismissed,
  platform,
  canPrompt,
}: {
  hasPasses: boolean
  standalone: boolean
  dismissed: boolean
  platform: Platform
  /** The browser handed over its install prompt (Chrome on Android and desktop). */
  canPrompt: boolean
}): boolean {
  if (!hasPasses || standalone || dismissed) return false
  return platform === 'ios' || canPrompt
}
