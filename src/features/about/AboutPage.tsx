import type { ReactNode } from 'react'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'

const INSTAGRAM = 'https://www.instagram.com/crampingapey'
const COFFEE = 'https://buymeacoffee.com/Crampingapey'

/** A link to another website: opens in its own tab so the app stays where it was (D54). */
function OutsideLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: ReactNode
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** Who made the app, with a link to their Instagram and a way to say thanks (D54, FR-74). */
export default function AboutPage() {
  return (
    <Page title="About">
      <p className="mb-6 text-lg">
        Developed by{' '}
        <OutsideLink
          href={INSTAGRAM}
          className="font-medium text-brand-700 underline dark:text-brand-400"
        >
          @crampingapey
        </OutsideLink>
      </p>
      <p className="mb-6">
        <OutsideLink href={COFFEE} className={buttonClass('primary')}>
          Buy me a coffee
        </OutsideLink>
      </p>
      <p className="pb-8 text-sm text-stone-600 dark:text-stone-400">
        Climb Pass Tracker, version {__APP_VERSION__}
      </p>
    </Page>
  )
}
