import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Page } from '../../components/Page'
import { repo } from '../../db'
import { DataSettings } from './DataSettings'
import { InstallHelp } from './InstallHelp'
import { ReminderSettings } from './ReminderSettings'

export default function SettingsPage() {
  const settings = useLiveQuery(() => repo.getSettings(), [])

  return (
    <Page title="Settings" back={{ to: '/', label: 'Passes' }}>
      {settings && <ReminderSettings settings={settings} />}
      <DataSettings />
      <InstallHelp />
      <nav aria-label="About" className="mb-4 flex flex-wrap gap-x-2">
        {[
          { to: '/privacy', label: 'Privacy policy' },
          { to: '/terms', label: 'Terms of use' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-base font-medium text-teal-700 underline dark:text-teal-300"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="pb-8 text-sm text-slate-600 dark:text-slate-400">
        Climb Pass Tracker, version {__APP_VERSION__}
      </p>
    </Page>
  )
}
