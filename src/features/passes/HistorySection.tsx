import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { TextField } from '../../components/forms'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { NotFoundError } from '../../db/repo'
import { formatDate, type LocalDate } from '../../domain/dates'
import { refusedDateMessage } from '../../domain/format'
import { findGym, type GymEntry } from '../../domain/gyms'
import { buildHistory, type HistoryEntry } from '../../domain/history'
import type { Row } from '../../domain/rows'
import { isCounted } from '../../domain/types'

/** How many lines are shown at first, and how many more each "Show more" adds. */
const PAGE = 30

const muted = 'text-stone-600 dark:text-stone-400'

/** One recorded use, with its date and a way to change the date (saved only by Save, D49). */
function HistoryItem({
  entry,
  today,
  editing,
  onEdit,
  onClose,
  onSaved,
  takeFocus,
}: {
  entry: HistoryEntry
  today: LocalDate
  editing: boolean
  onEdit: () => void
  /** The editor was closed, saved or not: the "Change date" button should get the focus back. */
  onClose: (saved: boolean) => void
  onSaved: (entry: HistoryEntry) => void
  /** True once, right after this line's editor closed: its button then takes the focus back. */
  takeFocus: (id: string) => boolean
}) {
  const [draft, setDraft] = useState(entry.date)
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const name = `${entry.gymName}, ${entry.typeLabel}`

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await repo.updateUseDate(entry.use.id, draft, today)
      if (result.ok) {
        onSaved(entry)
        onClose(true)
      } else {
        setError(refusedDateMessage(result))
      }
    } catch (failure) {
      if (!(failure instanceof NotFoundError)) throw failure
      setError('This entry is no longer there.')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose(false)
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium">{formatDate(entry.date)}</p>
          <p className={`break-words text-sm ${muted}`}>
            {entry.gymName} · {entry.typeLabel}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            ref={(button) => {
              if (button && takeFocus(entry.use.id)) button.focus()
            }}
            aria-label={`Change date: ${name}, ${formatDate(entry.date)}`}
            onClick={() => {
              setDraft(entry.date)
              setError(undefined)
              onEdit()
            }}
            className={buttonClass('secondary')}
          >
            Change date
          </button>
        )}
      </div>
      {editing && (
        <form onSubmit={(e) => void save(e)} onKeyDown={onKeyDown} noValidate className="mt-3">
          <TextField
            label="Date of this entry"
            type="date"
            value={draft}
            min={entry.pass.purchaseDate}
            max={today}
            autoFocus
            onChange={(e) => {
              setDraft(e.target.value)
              setError(undefined)
            }}
            error={error}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonClass('primary')}>
              Save
            </button>
            <button
              type="button"
              onClick={() => onClose(false)}
              className={buttonClass('secondary')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

/**
 * The usage history (D58, FR-77): a collapsed section below Finished listing every recorded use,
 * newest first, with its gym, pass type and date. The date of a use can be changed. Hidden while
 * there is nothing to list.
 */
export function HistorySection({
  active,
  finished,
  gyms,
  today,
  onSaved,
  className = 'mt-6',
}: {
  active: Row[]
  finished: Row[]
  gyms: GymEntry[]
  today: LocalDate
  onSaved: (entry: HistoryEntry) => void
  className?: string
}) {
  const entries = useMemo(
    () =>
      buildHistory(
        [...active, ...finished].map((row) => row.bundle),
        (ref) => findGym(gyms, ref)?.name ?? 'Unknown gym',
      ),
    [active, finished, gyms],
  )
  const [shown, setShown] = useState(PAGE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const refocus = useRef<string | null>(null)

  if (entries.length === 0) return null
  const visible = entries.slice(0, shown)
  const hasUndated = [...active, ...finished].some(
    ({ pass }) => isCounted(pass) && pass.initialUsed > 0,
  )

  return (
    <details className={`group ${className}`}>
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium">
        <span
          aria-hidden="true"
          className="mr-2 inline-block transition-transform group-open:rotate-90"
        >
          ›
        </span>
        History ({entries.length})
      </summary>
      <div className="mt-2">
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <ul
            aria-label="Usage history"
            className="divide-y divide-stone-200 dark:divide-stone-800"
          >
            {visible.map((entry) => (
              <HistoryItem
                key={entry.use.id}
                entry={entry}
                today={today}
                editing={editingId === entry.use.id}
                onEdit={() => setEditingId(entry.use.id)}
                onClose={() => {
                  refocus.current = entry.use.id
                  setEditingId(null)
                }}
                onSaved={onSaved}
                takeFocus={(id) => {
                  const mine = refocus.current === id
                  if (mine) refocus.current = null
                  return mine
                }}
              />
            ))}
          </ul>
        </div>
        {entries.length > visible.length && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className={`${buttonClass('secondary')} mt-3 w-full sm:w-auto`}
          >
            Show more ({entries.length - visible.length} more)
          </button>
        )}
        {hasUndated && (
          <p className={`mt-3 text-sm ${muted}`}>
            Entries counted as already used when a pass was added have no date, so they are not
            listed.
          </p>
        )}
      </div>
    </details>
  )
}
