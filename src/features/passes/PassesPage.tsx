import { useCallback, useRef, useState } from 'react'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import type { Row } from '../../domain/rows'
import { InstallPrompt } from '../install/InstallPrompt'
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
  // Set when the blank row closes, so the button that replaces it takes the focus and the keyboard
  // does not lose its place.
  const focusButton = useRef(false)
  const closeRow = () => {
    focusButton.current = true
    setAdding(false)
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
  } else if (notice?.kind === 'added') {
    const row = [...active, ...finished].find((r) => r.pass.id === notice.passId)
    if (row) shownNotice = { ...notice, what: `${row.gymName}, ${row.typeLabel}` }
  }
  const reminded = new Set(reminders.map((r) => r.passId))
  const lists = {
    gyms,
    today,
    openId,
    reminded,
    addedId: shownNotice?.kind === 'added' ? shownNotice.passId : null,
    onToggle: toggle,
    onClose: close,
    onUsedLast: usedLast,
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
      <InstallPrompt />

      {active.length > 0 && <RowList rows={active} label="Passes" {...lists} />}

      {active.length === 0 ? (
        <NewRow gyms={gyms} today={today} onAdded={added} />
      ) : adding ? (
        <NewRow gyms={gyms} today={today} autoFocus onAdded={added} onClose={closeRow} />
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
