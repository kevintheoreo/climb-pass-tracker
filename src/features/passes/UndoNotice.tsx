import { useEffect, useState } from 'react'
import { buttonClass } from '../../components/formUtils'

export interface Notice {
  /** A new number each time, so a repeat notice restarts the timer. */
  key: number
  /**
   * `finished`: a pass moved to Finished (with Undo). `added`: a pass was just added. `saved`: a
   * change in the details panel was saved.
   */
  kind: 'finished' | 'added' | 'saved' | 'deleted'
  passId: string
  /** The pass, e.g. "Fitbloc, Multipass". */
  what: string
}

/** How long each kind stays: the one with a button to press stays longer. */
const SHOW_MS = { finished: 8000, added: 4000, saved: 2500, deleted: 2500 } as const

/** One notice on screen. A new notice is a new box, so nothing carries over from the last one. */
function NoticeBox({
  notice,
  onUndo,
  onDismiss,
}: {
  notice: Notice
  onUndo: (notice: Notice) => void
  onDismiss: () => void
}) {
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (focused) return
    const timer = setTimeout(onDismiss, SHOW_MS[notice.kind])
    return () => clearTimeout(timer)
  }, [focused, onDismiss, notice.kind])

  return (
    <div
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-stone-900 py-1 pl-4 pr-1 text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
    >
      {notice.kind === 'saved' ? (
        <p className="py-2.5 pr-3 text-base font-medium">Changes saved</p>
      ) : notice.kind === 'deleted' ? (
        <p className="py-2.5 pr-3 text-base font-medium">Entry deleted</p>
      ) : notice.kind === 'added' ? (
        <p className="py-2.5 pr-3 text-base">
          <span className="font-medium">{notice.what}</span> added
        </p>
      ) : (
        <>
          <p className="text-base">
            <span className="font-medium">{notice.what}</span> moved to Finished
          </p>
          <button
            type="button"
            onClick={() => onUndo(notice)}
            className={`${buttonClass('secondary')} shrink-0`}
          >
            Undo
          </button>
        </>
      )}
    </div>
  )
}

/**
 * A notice at the bottom of the screen: "Changes saved" after the details panel saved something (it
 * is fixed to the screen, so it is seen wherever the long panel is scrolled to), "Fitbloc, Multipass
 * added" after a pass is added (D46), or
 * "moved to Finished · Undo" after `−` uses a pass's last entry. For the second, the
 * row has left the main list, and this says where it went; Undo gives the entry back, the same
 * as `+` in Finished. It goes away by itself after a few seconds. It waits only while a button in
 * it has keyboard focus, and not while hovered: a resting mouse pointer, or a finger that tapped
 * its text on a phone, would otherwise hold it on screen for good.
 */
export function UndoNotice({
  notice,
  onUndo,
  onDismiss,
}: {
  notice: Notice | null
  onUndo: (notice: Notice) => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4"
    >
      {notice && (
        <NoticeBox key={notice.key} notice={notice} onUndo={onUndo} onDismiss={onDismiss} />
      )}
    </div>
  )
}
