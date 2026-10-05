import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRightIcon, CameraIcon, CoffeeIcon, MonkeyIcon } from '../../app/icons'
import { usePageTitle } from '../../components/usePageTitle'
import { buttonClass } from '../../components/formUtils'

const INSTAGRAM = 'https://www.instagram.com/crampingapey'
const QUIZ = 'https://climbertype.vercel.app/'
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

const cardClass =
  'rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900'

/**
 * Who made the app (D54, FR-74): a bold orange top with the monkey, the developer's Instagram and
 * climber-quiz site as tappable cards, and a warm card for Buy me a coffee. White on the main orange is 3.3:1, so only
 * large bold text sits on the orange band (3:1 is enough for that).
 */
export default function AboutPage() {
  usePageTitle('About')
  return (
    <div className="pb-10">
      <section className="rounded-b-[2.5rem] bg-brand-500 px-4 pb-8 pt-5 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-left text-2xl font-bold">About</h1>
          <div className="mt-4 flex justify-center text-brand-50">
            <MonkeyIcon size={104} />
          </div>
        </div>
      </section>

      <div className="mx-auto mt-6 w-full max-w-3xl space-y-4 px-4">
        <OutsideLink
          href={INSTAGRAM}
          className={`${cardClass} flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 p-4`}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400">
            <CameraIcon size={26} />
          </span>
          <span className="min-w-0 flex-1 basis-32">
            <span className="block text-sm text-stone-600 dark:text-stone-400">Developed by</span>
            <span className="block break-all text-lg font-bold">@crampingapey</span>
          </span>
          <span className="text-stone-500 dark:text-stone-400">
            <ArrowUpRightIcon />
          </span>
        </OutsideLink>

        <OutsideLink
          href={QUIZ}
          className={`${cardClass} flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 p-4`}
        >
          <img
            src="/climbertype.png"
            alt=""
            width="48"
            height="48"
            className="size-12 shrink-0 rounded-xl"
          />
          <span className="min-w-0 flex-1 basis-32">
            <span className="block text-lg font-bold">Climber type quiz</span>
            <span className="block text-sm text-stone-600 dark:text-stone-400">
              What type of climber are you?
            </span>
          </span>
          <span className="text-stone-500 dark:text-stone-400">
            <ArrowUpRightIcon />
          </span>
        </OutsideLink>

        <div className="rounded-2xl border border-[#F5A43A]/50 bg-[#F5A43A]/20 p-4 dark:border-[#F5A43A]/40 dark:bg-[#F5A43A]/15">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#F5A43A]/40 text-stone-900 dark:text-stone-100">
              <CoffeeIcon size={26} />
            </span>
            <p className="text-lg font-bold">Enjoying the app?</p>
          </div>
          <OutsideLink href={COFFEE} className={`${buttonClass('primary')} mt-4 w-full`}>
            Buy me a coffee
          </OutsideLink>
        </div>

        <footer className="pt-2 text-center text-sm text-stone-600 dark:text-stone-400">
          <p>Version {__APP_VERSION__}</p>
          <nav aria-label="Legal" className="mt-1 flex flex-wrap justify-center gap-x-2">
            {[
              { to: '/privacy', label: 'Privacy policy' },
              { to: '/terms', label: 'Terms of use' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-brand-700 underline dark:text-brand-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  )
}
