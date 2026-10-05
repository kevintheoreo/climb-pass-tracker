import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronLeftIcon, SettingsIcon } from './icons'

/** Where the back link in the header goes, for the screens that are not the main one. */
const BACK: Record<string, { to: string; label: string }> = {
  '/settings': { to: '/', label: 'Passes' },
  '/privacy': { to: '/settings', label: 'Settings' },
  '/terms': { to: '/settings', label: 'Settings' },
}

/**
 * The whole app is one main screen; the only other place to go is Settings, behind the gear (D23).
 * On any other screen the header's left side is a back link (D51) in place of the app name, as on
 * a phone's own apps; the screen's name is its heading.
 */
export function Layout() {
  const back = BACK[useLocation().pathname]
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-brand-50/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
          {back ? (
            <Link
              to={back.to}
              aria-label={`Back to ${back.label}`}
              className="-ml-3 inline-flex min-h-11 items-center gap-0.5 rounded-lg pl-1.5 pr-3 text-base font-medium text-brand-700 dark:text-brand-400"
            >
              <ChevronLeftIcon />
              {back.label}
            </Link>
          ) : (
            <span className="py-2 text-lg font-semibold">Climb Pass Tracker</span>
          )}
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg ${
                isActive
                  ? 'text-brand-700 dark:text-brand-400'
                  : 'text-stone-600 dark:text-stone-400'
              }`
            }
          >
            <SettingsIcon />
          </NavLink>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
