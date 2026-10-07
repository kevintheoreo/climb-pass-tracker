import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buttonClass } from '../../components/formUtils'
import { formatDate, localDateOfTimestamp } from '../../domain/dates'
import { parseAuthReturn } from '../../domain/dropbox'
import {
  DropboxError,
  dropboxAppKey,
  failureMessage,
  savedState,
  signInUrl,
  type DropboxFailure,
} from './dropboxApi'
import {
  backupNow,
  connect,
  disconnect,
  fetchBackupText,
  markRestored,
  readConnection,
} from './dropboxBackup'

const muted = 'text-sm text-stone-600 dark:text-stone-400'

const failureOf = (failure: unknown): DropboxFailure =>
  failure instanceof DropboxError ? failure.failure : 'other'

/**
 * The optional Dropbox backup (D59, FR-78), in Settings under the backup file. Connect once and the
 * app saves a backup in its own Dropbox folder when it is opened, once a day; a new phone connects
 * and restores it. Hidden in a build with no Dropbox app key. `onRestore` hands the text of the
 * backup in Dropbox to the same look-over-then-add steps as a backup file.
 */
export function DropboxBackup({
  onRestore,
  go = (url) => window.location.assign(url),
}: {
  onRestore: (text: string, name: string, afterAdded: () => Promise<void>) => Promise<void>
  /** Leaves for Dropbox's sign-in page (replaceable in tests). */
  go?: (url: string) => void
}) {
  const appKey = dropboxAppKey()
  const connection = useLiveQuery(async () => (await readConnection()) ?? null, [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const handled = useRef(false)

  // Dropbox sends the person back here with a code in the address: finish the sign-in once.
  useEffect(() => {
    if (!appKey || handled.current) return
    const result = parseAuthReturn(location.search, savedState())
    if (result.kind === 'none') return
    handled.current = true
    navigate('/settings', { replace: true })
    async function finish() {
      await Promise.resolve()
      if (result.kind === 'denied') {
        setMessage('Dropbox was not connected.')
      } else if (result.kind === 'mismatch') {
        setMessage('That Dropbox sign-in did not start here, so it was ignored. Please try again.')
      } else if (result.kind === 'code') {
        setBusy(true)
        try {
          await connect(result.code)
          setMessage('Dropbox is connected.')
        } catch (failure) {
          setMessage(failureMessage(failureOf(failure)))
        } finally {
          setBusy(false)
        }
      }
    }
    void finish()
  }, [appKey, location.search, navigate])

  if (!appKey || connection === undefined) return null

  async function act(work: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    try {
      setMessage(await work())
    } catch (failure) {
      setMessage(failureMessage(failureOf(failure)))
    } finally {
      setBusy(false)
    }
  }

  const signIn = () =>
    act(async () => {
      go(await signInUrl(appKey))
      return ''
    })

  return (
    <section aria-labelledby="dropbox-heading" className="mt-6">
      <h3 id="dropbox-heading" className="mb-1 text-base font-semibold">
        Back up to Dropbox (optional)
      </h3>

      {connection === null ? (
        <>
          <p className="mb-3 text-base">
            Connect your Dropbox and the app saves a backup in its own folder in your Dropbox once a
            day, when you open it. On a new phone, connect Dropbox there and restore it. The backup
            goes only to your own Dropbox, and it is not encrypted, so anyone who can open your
            Dropbox can read it.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signIn()}
            className={buttonClass('secondary')}
          >
            Connect Dropbox
          </button>
        </>
      ) : (
        <>
          <p className="text-base">
            {connection.signedOut ? 'Dropbox needs you to connect again.' : 'Dropbox is connected.'}
          </p>
          <p className={`mb-3 ${muted}`}>
            {connection.lastBackupAt === null
              ? 'No Dropbox backup yet. It backs up once a day when you open the app.'
              : `Last Dropbox backup: ${formatDate(localDateOfTimestamp(connection.lastBackupAt))}. Dropbox keeps older versions of the file for a while.`}
          </p>
          {connection.needsChoice && (
            <p
              role="status"
              className="mb-3 rounded-lg border border-amber-600 bg-amber-50 p-3 text-base dark:border-amber-500 dark:bg-amber-950"
            >
              Your Dropbox already has a backup, probably from another phone, so nothing was
              replaced. Restore it to this phone first, or choose Back up now to replace it with
              what is on this phone.
            </p>
          )}
          {connection.lastError && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-300 p-3 text-base text-red-800 dark:border-red-800 dark:text-red-300"
            >
              {connection.lastError}
            </p>
          )}
          <div className="flex flex-col items-start gap-3">
            {connection.signedOut ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void signIn()}
                className={buttonClass('primary')}
              >
                Connect Dropbox again
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await backupNow()
                      return 'Backed up to Dropbox.'
                    })
                  }
                  className={buttonClass('secondary')}
                >
                  Back up now
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await onRestore(await fetchBackupText(), 'Backup in Dropbox', markRestored)
                      return ''
                    })
                  }
                  className={buttonClass('secondary')}
                >
                  Restore from Dropbox
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await disconnect()
                  return 'Disconnected. Your backup stays in your Dropbox.'
                })
              }
              className={buttonClass('secondary')}
            >
              Disconnect Dropbox
            </button>
          </div>
        </>
      )}
      <div aria-live="polite" className="mt-3">
        {message && <p className={muted}>{message}</p>}
      </div>
    </section>
  )
}
