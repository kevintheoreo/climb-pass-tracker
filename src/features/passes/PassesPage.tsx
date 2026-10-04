import { useCallback, useRef, useState } from 'react'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import type { PassDraft } from '../../domain/passForm'
import type { Row } from '../../domain/rows'
import { InstallPrompt } from '../install/InstallPrompt'
import { BackupNudge } from '../settings/BackupNudge'
import { NewRow } from './NewRow'
import { ReminderBanners } from './ReminderBanners'
import { RowList } from './RowList'
import { UndoNotice, type Notice } from './UndoNotice'
import { usePassRows } from './usePassRows'

export default function PassesPage() {
  const rows = usePassRows()
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const dismiss = useCallback(() => setNotice(null), [])
  // The blank row is hidden behind a button once there is a pass (it is always shown while there
  // are none). `adding` is whether the person opened it.
  const [adding, setAdding] = useState(false)
  // "Buy again" opens the blank row with a pass's details in it; `fresh` makes the row start over.
  const [prefill, setPrefill] = useState<{ draft: PassDraft; key: number } | null>(null)
  // Set when the blank row closes, so the button that replaces it takes the focus and the keyboard
  // does not lose its place.
  const focusButton = useRef(false)
  const closeRow = () => {
    focusButton.current = true
    setAdding(false)
    setPrefill(null)
  }
  const buyAgain = (draft: PassDraft) => {
    setOpenId(null)
    setPrefill({ draft, key: Date.now() })
    setAdding(true)
  }

  if (!rows) return <Page title="Passes" />

  const { active, finished, today, gyms, reminders } = rows
  const toggle = (passId: string) => setOpenId((open) => (open === passId ? null : passId))
  const close = () => setOpenId(null)
  const usedLast = (row: Row) =>
    setNotice({
      key: Date.now(),
      kind: 'finished',
      passId: row.pass.id,
      what: `${row.gymName}, ${row.typeLabel}`,
    })
  // A change in the details panel was saved: say so, wherever the long panel is scrolled to.
  const saved = (row: Row) =>
    setNotice({ key: Date.now(), kind: 'saved', passId: row.pass.id, what: '' })
  // A pass was just added: say so (the name is filled in below, once its row is on screen).
  const added = (passId: string) => {
    closeRow()
    setNotice({ key: Date.now(), kind: 'added', passId, what: '' })
  }
  const undo = async (shown: Notice) => {
    setNotice(null)
    try {
      await repo.giveBackEntry(shown.passId, today)
    } catch {
      // The pass was deleted in the meantime: nothing to give back.
    }
  }
  // "Moved to Finished" shows only while the pass is still in Finished: give the entry back some
  // other way and it goes away. "Added" shows once the new row is on screen, with its name.
  let shownNotice: Notice | null = null
  if (notice?.kind === 'finished') {
    shownNotice = finished.some((row) => row.pass.id === notice.passId) ? notice : null
  } else if (notice?.kind === 'saved') {
    shownNotice = notice
  } else if (notice?.kind === 'added') {
    const row = [...active, ...finished].find((r) => r.pass.id === notice.passId)
    if (row) shownNotice = { ...notice, what: `${row.gymName}, ${row.typeLabel}` }
  }
  const reminded = new Set(reminders.map((r) => r.passId))
  // When the oldest pass was added: the backup reminder counts from here if there was no backup.
  const firstPassAt = [...active, ...finished].map((r) => r.pass.createdAt).sort()[0] ?? null
  const lists = {
    gyms,
    today,
    openId,
    reminded,
    addedId: shownNotice?.kind === 'added' ? shownNotice.passId : null,
    onToggle: toggle,
    onClose: close,
    onUsedLast: usedLast,
    onBuyAgain: buyAgain,
    onSaved: saved,
  }

  return (
    <Page title="Passes">
      {active.length === 0 && finished.length === 0 && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          No passes yet. Add your first one below.
        </p>
      )}
      {active.length === 0 && finished.length > 0 && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">No active passes.</p>
      )}

      <ReminderBanners reminders={reminders} rows={active} />
      <BackupNudge
        today={today}
        hasPasses={active.length + finished.length > 0}
        firstPassAt={firstPassAt}
      />
      <InstallPrompt />

      {active.length > 0 && <RowList rows={active} label="Passes" {...lists} />}

      {active.length === 0 ? (
        <NewRow
          key={prefill?.key}
          gyms={gyms}
          today={today}
          autoFocus={prefill !== null}
          {...(prefill && { initial: prefill.draft })}
          onAdded={added}
        />
      ) : adding ? (
        <NewRow
          key={prefill?.key}
          gyms={gyms}
          today={today}
          autoFocus
          {...(prefill && { initial: prefill.draft })}
          onAdded={added}
          onClose={closeRow}
        />
      ) : (
        <button
          ref={(button) => {
            if (button && focusButton.current) {
              focusButton.current = false
              button.focus()
            }
          }}
          type="button"
          onClick={() => setAdding(true)}
          className={`${buttonClass('secondary')} mt-4 w-full sm:w-auto`}
        >
          <span aria-hidden="true" className="mr-2">
            +
          </span>
          Add a pass
        </button>
      )}

      {finished.length > 0 && (
        <details className="group mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium">
            <span
              aria-hidden="true"
              className="mr-2 inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
            Finished ({finished.length})
          </summary>
          <div className="mt-2">
            <RowList rows={finished} label="Finished passes" {...lists} />
          </div>
        </details>
      )}

      {/* Room to scroll the last rows above the notice, which sits at the bottom of the screen. */}
      {shownNotice && <div aria-hidden="true" className="h-28" />}
      <UndoNotice notice={shownNotice} onUndo={(n) => void undo(n)} onDismiss={dismiss} />
    </Page>
  )
}
