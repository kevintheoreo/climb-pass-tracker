import { useState } from 'react'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { passesCsv, usesCsv } from '../../domain/csv'
import { todayLocal } from '../../domain/dates'
import { findGym } from '../../domain/gyms'
import { downloadTextFile } from './download'

async function exportData(kind: 'passes' | 'uses') {
  const [bundles, gyms] = await Promise.all([repo.listBundles(), repo.listGyms()])
  const today = todayLocal()
  const gymName = (ref: Parameters<typeof findGym>[1]) => findGym(gyms, ref)?.name ?? 'Unknown gym'
  if (kind === 'passes') {
    downloadTextFile(`climb-passes-${today}.csv`, passesCsv(bundles, gymName, today))
  } else {
    downloadTextFile(`climb-pass-uses-${today}.csv`, usesCsv(bundles, gymName))
  }
}

/** Where the data lives, how to take a copy, and how to wipe it (FR-42, FR-45, FR-47). */
export function DataSettings() {
  const [message, setMessage] = useState('')

  return (
    <section aria-labelledby="data-heading" className="mb-6">
      <h2 id="data-heading" className="mb-1 text-lg font-semibold">
        Your data
      </h2>
      <p className="mb-3 text-base">
        Your passes are saved <strong>only on this device</strong>. If you clear this app’s data,
        change phones or delete the app, they are gone. Download a copy now and then.
      </p>
      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={() =>
            void exportData('passes').then(() => setMessage('Passes file downloaded.'))
          }
          className={buttonClass('secondary')}
        >
          Download passes (CSV)
        </button>
        <button
          type="button"
          onClick={() => void exportData('uses').then(() => setMessage('Uses file downloaded.'))}
          className={buttonClass('secondary')}
        >
          Download recorded uses (CSV)
        </button>
        <ConfirmDelete
          label="Delete all data on this device"
          prompt="Delete every pass and every gym you added on this device? This can’t be undone. Download a copy first if you want to keep one."
          onConfirm={async () => {
            await repo.clearAllData()
            setMessage('All data on this device was deleted.')
          }}
        />
      </div>
      <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {message}
      </p>
    </section>
  )
}
