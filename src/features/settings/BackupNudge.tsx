import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { BACKUP_SNOOZE_DAYS, backupNudge } from '../../domain/backupNudge'
import { addDays, type LocalDate } from '../../domain/dates'
import { backupNudgeText } from '../../domain/format'
import { downloadBackupFile } from './backupDownload'

/**
 * Asks for a backup file when there has not been one for 30 days (D47). It is worked out when the
 * main screen opens, from the saved time of the last backup, so it never pops in while the person
 * is tapping. "Remind me later" hides it for a week; downloading a backup starts the 30 days again.
 */
export function BackupNudge({
  today,
  hasPasses,
  firstPassAt,
}: {
  today: LocalDate
  hasPasses: boolean
  firstPassAt: string | null
}) {
  const state = useLiveQuery(() => repo.getBackupState(), [])
  const [failed, setFailed] = useState(false)
  if (!state) return null

  const nudge = backupNudge({ today, hasPasses, firstPassAt, ...state })
  if (!nudge.show) return null

  return (
    <section
      aria-labelledby="backup-nudge-heading"
      className="mb-4 rounded-lg border border-stone-400 bg-white p-4 dark:border-stone-600 dark:bg-stone-900"
    >
      <h2 id="backup-nudge-heading" className="text-base font-semibold">
        Back up your passes
      </h2>
      <p className="mb-3 mt-1 text-base">{backupNudgeText(nudge, today)}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            downloadBackupFile().catch(() => setFailed(true))
          }}
          className={buttonClass('primary')}
        >
          Download backup file
        </button>
        <button
          type="button"
          onClick={() => void repo.snoozeBackupNudge(addDays(today, BACKUP_SNOOZE_DAYS))}
          className={buttonClass('secondary')}
        >
          Remind me in a week
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          Could not make the backup file. Try again.
        </p>
      )}
    </section>
  )
}
