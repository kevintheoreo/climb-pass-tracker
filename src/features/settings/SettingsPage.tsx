import { useLiveQuery } from 'dexie-react-hooks'
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
      <p className="pb-8 text-sm text-slate-600 dark:text-slate-400">
        Climb Pass Tracker, version {__APP_VERSION__}
      </p>
    </Page>
  )
}
