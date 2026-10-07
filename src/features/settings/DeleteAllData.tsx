import { useState } from 'react'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { repo } from '../../db'

/** The one way to wipe the device (FR-47), kept apart at the bottom of Settings. */
export function DeleteAllData() {
  const [message, setMessage] = useState('')

  return (
    <section aria-labelledby="delete-heading" className="mb-6">
      <h2 id="delete-heading" className="mb-2 text-lg font-semibold">
        Delete everything
      </h2>
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
