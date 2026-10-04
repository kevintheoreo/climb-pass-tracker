import { useRef, useState } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import {
  backupFilename,
  backupToText,
  parseBackup,
  type Backup,
  type ImportSummary,
} from '../../domain/backup'
import { todayLocal } from '../../domain/dates'
import { importLines } from '../../domain/format'
import { downloadTextFile } from './download'

/** A backup is a few kilobytes. Anything this big is not one, and reading it could hang a phone. */
const MAX_BYTES = 20_000_000
const JSON_TYPE = 'application/json'

type Stage =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; fileName: string; backup: Backup; summary: ImportSummary }
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

  async function makeBackup() {
    const backup = await repo.exportBackup()
    return { backup, text: backupToText(backup), name: backupFilename(todayLocal()) }
  }

  async function download() {
    const { backup, text, name } = await makeBackup()
    downloadTextFile(name, text, JSON_TYPE)
    setStage({ kind: 'idle' })
    setMessage(
      `Backup file downloaded (${backup.passes.filter((p) => p.deletedAt === null).length} passes). ` +
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
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setStage({ kind: 'error', message: parsed.error })
      return
    }
    setStage({
      kind: 'preview',
      fileName: file.name,
      backup: parsed.backup,
      summary: await repo.previewImport(parsed.backup),
    })
  }

  async function add(backup: Backup) {
    setBusy(true)
    try {
      setStage({ kind: 'done', summary: await repo.importBackup(backup) })
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
      <h3 className="mb-1 text-base font-semibold">Back up or move to another device</h3>
      <p className="mb-3 text-base">
        To move to a new phone, or to keep a copy safe: download a backup file here, send it to the
        other device (a message, email, AirDrop or cloud drive), then open it there under Settings.
      </p>
      <div className="flex flex-col items-start gap-3">
        <button type="button" onClick={run(download)} className={buttonClass('secondary')}>
          Download backup file
        </button>
        <label
          className={`${buttonClass('secondary')} cursor-pointer focus-within:ring-2 focus-within:ring-teal-600`}
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

      <div className="mt-3" aria-live="polite">
        {message && <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>}

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
            className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
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
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
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
                  onClick={() => void add(stage.backup)}
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
            className="rounded-lg border border-teal-300 p-3 text-base dark:border-teal-800"
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
