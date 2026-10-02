import { useEffect, useState } from 'react'
import { buttonClass } from '../../components/formUtils'

export interface Notice {
  /** A new number each time, so a repeat notice restarts the timer. */
  key: number
  passId: string
  /** What moved, e.g. "Fitbloc, Multipass". */
  what: string
}

const SHOW_MS = 8000

/**
 * "Moved to Finished · Undo" at the bottom of the screen after `−` uses a pass's last entry. The
 * row has left the main list, and this says where it went; Undo gives the entry back, the same
 * as `+` in Finished. It goes away by itself, but waits while it is hovered or focused.
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
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!notice || held) return
    const timer = setTimeout(onDismiss, SHOW_MS)
    return () => clearTimeout(timer)
  }, [notice, held, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4"
    >
      {notice && (
        <div
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 py-1 pl-4 pr-1 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
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
        </div>
      )}
    </div>
  )
}
