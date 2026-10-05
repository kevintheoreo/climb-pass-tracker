import { NavLink, Outlet } from 'react-router-dom'
import { SettingsIcon } from './icons'

/** The whole app is one main screen; the only other place to go is Settings, behind the gear (D23). */
export function Layout() {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-brand-50/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
          <span className="py-2 text-lg font-semibold">Climb Pass Tracker</span>
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
