import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Page } from '../../components/Page'
import { repo } from '../../db'
import { DataSettings } from './DataSettings'
import { DeleteAllData } from './DeleteAllData'
import { InstallHelp } from './InstallHelp'
import { ReminderSettings } from './ReminderSettings'

export default function SettingsPage() {
  const settings = useLiveQuery(() => repo.getSettings(), [])

  return (
    <Page title="Settings">
      <DataSettings />
      {settings && <ReminderSettings settings={settings} />}
      <InstallHelp />
      <DeleteAllData />
      <nav aria-label="About and legal" className="mb-4 flex flex-wrap gap-x-2">
        {[
          { to: '/about', label: 'About' },
          { to: '/privacy', label: 'Privacy policy' },
          { to: '/terms', label: 'Terms of use' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-base font-medium text-brand-700 underline dark:text-brand-400"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="pb-8 text-sm text-stone-600 dark:text-stone-400">
        Climb Pass Tracker, version {__APP_VERSION__}
      </p>
    </Page>
  )
}
