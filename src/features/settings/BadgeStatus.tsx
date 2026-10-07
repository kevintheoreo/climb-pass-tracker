import { useState } from 'react'
import { badgeSupported, lastBadgeReport } from '../passes/useAppBadge'

/**
 * One line saying whether this browser can put a number on the app's icon (FR-35) and what the app
 * last asked for, so a missing badge can be told apart: no support, a refusal, or a phone setting.
 */
export function BadgeStatus() {
  const [supported] = useState(badgeSupported)
  const [report] = useState(lastBadgeReport)

  let text: string
  if (!supported) {
    text = 'Icon badge: this browser cannot show one.'
  } else if (!report) {
    text = 'Icon badge: supported. Nothing set yet since the app was opened.'
  } else if (report.outcome !== 'ok') {
    text = `Icon badge: supported, but the browser refused (${report.outcome}).`
  } else {
    text = `Icon badge: supported. The app last ${
      report.count > 0 ? `set it to ${report.count}` : 'cleared it'
    }; if you see nothing, check your phone’s notification settings for this app.`
  }
  return <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">{text}</p>
}
