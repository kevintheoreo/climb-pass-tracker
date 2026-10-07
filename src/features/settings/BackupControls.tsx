import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { parseBackup, type Backup, type ImportSummary } from '../../domain/backup'
import { formatDate, localDateOfTimestamp } from '../../domain/dates'
import { importLines } from '../../domain/format'
import { DropboxBackup } from '../dropbox/DropboxBackup'
import { downloadBackupFile } from './backupDownload'

/** A backup is a few kilobytes. Anything this big is not one, and reading it could hang a phone. */
const MAX_BYTES = 20_000_000

type Stage =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | {
      kind: 'preview'
      fileName: string
      backup: Backup
      summary: ImportSummary
      /** Runs once the backup has been added (or was already all here). */
      afterAdded?: () => Promise<void>
    }
  | { kind: 'done'; summary: ImportSummary }

function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="my-2 list-disc space-y-1 pl-5 text-base">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

/**
 * Moving to another device (D37, D38). There is no account, so a backup file is how data travels:
 * download one here, send it yourself, open it in the app on the other
 * device. Opening one first shows what it would change, then adds it to what is already there.
 */
export function BackupControls() {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const lastBackupAt = useLiveQuery(async () => (await repo.getBackupState()).lastBackupAt, [])

  async function download() {
    const passes = await downloadBackupFile()
    setStage({ kind: 'idle' })
    setMessage(
      `Backup file downloaded (${passes} passes). ` +
        'Send it to your other device, then open it there under Settings.',
    )
  }

  async function chosen(file: File | undefined) {
    if (!file) return
    setMessage('')
    if (file.size > MAX_BYTES) {
      setStage({
        kind: 'error',
        message: 'That file is too big to be a backup. Nothing was imported.',
      })
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setStage({ kind: 'error', message: 'Could not read that file. Nothing was imported.' })
      return
    }
    await chosenText(text, file.name)
  }

  /** Looks over the text of a backup (a file, or the one in Dropbox) and shows what it would add. */
  async function chosenText(text: string, name: string, afterAdded?: () => Promise<void>) {
    setMessage('')
    if (text.length > MAX_BYTES) {
      setStage({ kind: 'error', message: 'That is too big to be a backup. Nothing was imported.' })
      return
    }
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setStage({ kind: 'error', message: parsed.error })
      return
    }
    const summary = await repo.previewImport(parsed.backup)
    // Nothing to add: this device already holds everything in it.
    if (summary.nothingNew) await afterAdded?.()
    setStage({ kind: 'preview', fileName: name, backup: parsed.backup, summary, afterAdded })
  }

  async function add(backup: Backup, afterAdded?: () => Promise<void>) {
    setBusy(true)
    try {
      const summary = await repo.importBackup(backup)
      await afterAdded?.()
      setStage({ kind: 'done', summary })
    } catch {
      setStage({
        kind: 'error',
        message: 'Something went wrong while adding the backup. Nothing was changed.',
      })
    } finally {
      setBusy(false)
    }
  }

  const run = (action: () => Promise<void>) => () =>
    void action().catch(() => setMessage('Something went wrong. Please try again.'))

  return (
    <div>
      <h3 className="mb-1 text-base font-semibold">Backup file</h3>
      <p className="mb-3 text-base">
        To move to a new phone: download a file here, send it over, and open it there.
      </p>
      <div className="flex flex-col items-start gap-3">
        <button type="button" onClick={run(download)} className={buttonClass('secondary')}>
          Download backup file
        </button>
        <label
          className={`${buttonClass('secondary')} cursor-pointer focus-within:ring-2 focus-within:ring-brand-700`}
        >
          Open a backup file
          <input
            ref={picker}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // So choosing the same file again still counts as a change.
              e.target.value = ''
              void chosen(file)
            }}
          />
        </label>
      </div>
      {lastBackupAt !== undefined && (
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
          {lastBackupAt === null
            ? 'No backup made yet.'
            : `Last backup: ${formatDate(localDateOfTimestamp(lastBackupAt))}.`}
        </p>
      )}

      <DropboxBackup onRestore={chosenText} />

      <div className="mt-3" aria-live="polite">
        {message && <p className="text-sm text-stone-600 dark:text-stone-400">{message}</p>}

        {stage.kind === 'error' && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 p-3 text-base text-red-800 dark:border-red-800 dark:text-red-300"
          >
            {stage.message}
          </p>
        )}

        {stage.kind === 'preview' && (
          <section
            aria-label="Backup preview"
            className="rounded-lg border border-stone-300 bg-white p-3 dark:border-stone-700 dark:bg-stone-900"
          >
            <p className="text-base font-medium">{stage.fileName}</p>
            {stage.summary.nothingNew ? (
              <p className="my-2 text-base">
                Everything in this backup is already on this device. There is nothing to add.
              </p>
            ) : (
              <>
                <p className="mt-1 text-base">Adding it to this device will give you:</p>
                <Lines lines={importLines(stage.summary)} />
                <p className="mb-2 text-sm text-stone-600 dark:text-stone-400">
                  Passes on this phone stay. If a pass is on both phones, the version edited most
                  recently is kept, and recorded uses from both phones are counted.
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-3">
              {!stage.summary.nothingNew && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add(stage.backup, stage.afterAdded)}
                  className={buttonClass('primary')}
                >
                  Add to this device
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage({ kind: 'idle' })}
                className={buttonClass('secondary')}
              >
                {stage.summary.nothingNew ? 'Close' : 'Cancel'}
              </button>
            </div>
          </section>
        )}

        {stage.kind === 'done' && (
          <div
            role="status"
            className="rounded-lg border border-brand-300 p-3 text-base dark:border-brand-800"
          >
            <p className="font-medium">Done. This device now has:</p>
            {importLines(stage.summary).length > 0 ? (
              <Lines lines={importLines(stage.summary)} />
            ) : (
              <p className="my-1">Nothing new: everything was already here.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
