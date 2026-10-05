import { useState } from 'react'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { repo } from '../../db'
import { StorageStatus } from '../install/StorageStatus'
import { BackupControls } from './BackupControls'

/** Where the data lives, how to take a copy, and how to wipe it (FR-42, FR-47, FR-62). */
export function DataSettings() {
  const [message, setMessage] = useState('')

  return (
    <section aria-labelledby="data-heading" className="mb-6">
      <h2 id="data-heading" className="mb-1 text-lg font-semibold">
        Your data
      </h2>
      <p className="mb-4 text-base">
        Your passes are saved <strong>only on this device</strong>. There are no accounts. If you
        clear this app’s data, change phones or delete the app, they are gone, unless you have a
        backup file.
      </p>

      <StorageStatus />

      <BackupControls />

      <h3 className="mb-1 mt-6 text-base font-semibold">Start again</h3>
      <div className="flex flex-col items-start gap-3">
        <ConfirmDelete
          label="Delete all data on this device"
          prompt="Delete every pass and every gym you added on this device? This can’t be undone. Download a backup file first if you want to keep a copy."
          onConfirm={async () => {
            await repo.clearAllData()
            setMessage('All data on this device was deleted.')
          }}
        />
      </div>
      <p role="status" className="mt-3 text-sm text-stone-600 dark:text-stone-400">
        {message}
      </p>
    </section>
  )
}
