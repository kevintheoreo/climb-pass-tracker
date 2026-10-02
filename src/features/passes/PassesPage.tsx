import { useCallback, useState } from 'react'
import { Page } from '../../components/Page'
import { repo } from '../../db'
import type { Row } from '../../domain/rows'
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

  if (!rows) return <Page title="Passes" />

  const { active, finished, today, gyms, reminders } = rows
  const toggle = (passId: string) => setOpenId((open) => (open === passId ? null : passId))
  const close = () => setOpenId(null)
  const usedLast = (row: Row) =>
    setNotice({
      key: Date.now(),
      passId: row.pass.id,
      what: `${row.gymName}, ${row.typeLabel}`,
    })
  const undo = async (shown: Notice) => {
    setNotice(null)
    try {
      await repo.giveBackEntry(shown.passId, today)
    } catch {
      // The pass was deleted in the meantime: nothing to give back.
    }
  }
  // Only while the pass is still in Finished: give the entry back some other way and it goes away.
  const shownNotice =
    notice && finished.some((row) => row.pass.id === notice.passId) ? notice : null
  const reminded = new Set(reminders.map((r) => r.passId))
  const lists = {
    gyms,
    today,
    openId,
    reminded,
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

      {active.length > 0 && <RowList rows={active} label="Passes" {...lists} />}

      <NewRow gyms={gyms} today={today} />

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
