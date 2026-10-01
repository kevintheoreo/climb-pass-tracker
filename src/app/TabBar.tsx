import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { GymsIcon, HistoryIcon, PassesIcon, SettingsIcon } from './icons'

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Passes', icon: <PassesIcon /> },
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
  { to: '/gyms', label: 'Gyms', icon: <GymsIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
]

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map(({ to, label, icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-xs font-medium ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
