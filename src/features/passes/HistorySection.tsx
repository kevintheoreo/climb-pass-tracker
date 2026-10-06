import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { TextField } from '../../components/forms'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { NotFoundError } from '../../db/repo'
import {
  formatDate,
  formatMonthYear,
  formatWeekdayDayMonth,
  type LocalDate,
} from '../../domain/dates'
import { refusedDateMessage } from '../../domain/format'
import { findGym, type GymEntry } from '../../domain/gyms'
import { buildHistory, type HistoryEntry } from '../../domain/history'
import type { Row } from '../../domain/rows'
import { isCounted } from '../../domain/types'
import { motionAllowed, ROW_MOTION_MS } from './useRowMotion'

/** How many lines are shown at first, and how many more each "Show more" adds. */
const PAGE = 30

const muted = 'text-stone-600 dark:text-stone-400'

/**
 * One recorded use: its date, gym and pass type. Tapping the line, or its "Change date" button
 * (the way in for the keyboard and screen readers), opens the date box; it saves only with Save or
 * Enter (D49).
 */
function HistoryItem({
  entry,
  today,
  index,
  editing,
  moved,
  onEdit,
  onClose,
  onSaved,
  takeFocus,
}: {
  entry: HistoryEntry
  today: LocalDate
  /** Where the line is in the list: it changes when the line's date does. */
  index: number
  editing: boolean
  /** The date of this line was just changed: it slides in at its new place and takes the focus. */
  moved: boolean
  onEdit: () => void
  /** The editor was closed, saved or not: the "Change date" button should get the focus back. */
  onClose: () => void
  onSaved: (entry: HistoryEntry) => void
  /** True once, right after this line's editor closed: its button then takes the focus back. */
  takeFocus: (id: string) => boolean
}) {
  const [draft, setDraft] = useState(entry.date)
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const name = `${entry.gymName}, ${entry.typeLabel}`

  // A changed line moves to its new place a moment after it is saved: keep the focus on it there.
  useEffect(() => {
    if (moved) button.current?.focus()
  }, [moved, index])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await repo.updateUseDate(entry.use.id, draft, today)
      if (result.ok) {
        onSaved(entry)
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

  const startEditing = () => {
    setDraft(entry.date)
    setError(undefined)
    onEdit()
  }

  return (
    <li className={moved && motionAllowed() ? 'row-entering' : undefined}>
      <div className="row-body">
        {/* A tap anywhere on the line that is not a button opens the date box, as on a pass row. */}
        <div
          onClick={(e) => {
            if (editing) return
            if (e.target instanceof Element && e.target.closest('button, input, a')) return
            startEditing()
          }}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 ${
            editing ? '' : 'cursor-pointer'
          }`}
        >
          <div className="min-w-0">
            <p className="font-medium">{formatWeekdayDayMonth(entry.date)}</p>
            <p className={`break-words text-sm ${muted}`}>
              {entry.gymName} · {entry.typeLabel}
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              ref={(el) => {
                button.current = el
                if (el && takeFocus(entry.use.id)) el.focus()
              }}
              aria-label={`Change date: ${name}, ${formatDate(entry.date)}`}
              onClick={startEditing}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-base font-medium text-brand-700 underline dark:text-brand-400"
            >
              Change date
            </button>
          )}
        </div>
        {editing && (
          <form
            onSubmit={(e) => void save(e)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Escape') onClose()
            }}
            noValidate
            className="px-4 pb-3"
          >
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
              <button type="button" onClick={onClose} className={buttonClass('secondary')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </li>
  )
}

/** The lines of one month, in the order they come (newest first). */
function byMonth(
  entries: HistoryEntry[],
): { key: string; label: string; entries: HistoryEntry[] }[] {
  const months: { key: string; label: string; entries: HistoryEntry[] }[] = []
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    const last = months[months.length - 1]
    if (last && last.key === key) last.entries.push(entry)
    else months.push({ key, label: formatMonthYear(entry.date), entries: [entry] })
  }
  return months
}

/**
 * The usage history (D58, FR-77): a collapsed section below Finished listing every recorded use,
 * newest first and grouped by month, with its gym, pass type and date. The date of a use can be
 * changed; the changed line slides in at its new place. Hidden while there is nothing to list.
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
  // The line whose date was just changed, for as long as it takes to slide in.
  const [movedId, setMovedId] = useState<string | null>(null)
  const refocus = useRef<string | null>(null)
  const groupsId = useId()

  useEffect(() => {
    if (movedId === null) return
    const timer = setTimeout(() => setMovedId(null), ROW_MOTION_MS)
    return () => clearTimeout(timer)
  }, [movedId])

  // A line moved to an older date can land beyond the lines shown: show it, so it never vanishes.
  const movedIndex = movedId === null ? -1 : entries.findIndex((e) => e.use.id === movedId)
  if (movedIndex >= shown) setShown(movedIndex + 1)

  if (entries.length === 0) return null
  const visible = entries.slice(0, shown)
  const positions = new Map(entries.map((e, i) => [e.use.id, i]))
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
        <div
          role="group"
          aria-label="Usage history"
          className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
        >
          {byMonth(visible).map((month) => (
            <section
              key={month.key}
              aria-labelledby={`${groupsId}-${month.key}`}
              className="border-t border-stone-200 first:border-t-0 dark:border-stone-800"
            >
              <h3
                id={`${groupsId}-${month.key}`}
                className={`bg-stone-50 px-4 py-2 text-sm font-semibold dark:bg-stone-950 ${muted}`}
              >
                {month.label}
              </h3>
              <ul className="divide-y divide-stone-200 border-t border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                {month.entries.map((entry) => (
                  <HistoryItem
                    key={entry.use.id}
                    entry={entry}
                    today={today}
                    index={positions.get(entry.use.id) ?? 0}
                    editing={editingId === entry.use.id}
                    moved={movedId === entry.use.id}
                    onEdit={() => setEditingId(entry.use.id)}
                    onClose={() => {
                      refocus.current = entry.use.id
                      setEditingId(null)
                    }}
                    onSaved={(saved) => {
                      setMovedId(saved.use.id)
                      setEditingId(null)
                      onSaved(saved)
                    }}
                    takeFocus={(id) => {
                      const mine = refocus.current === id
                      if (mine) refocus.current = null
                      return mine
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
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
        <p className={`mt-3 text-sm ${muted}`}>
          Forgot to tap? Tap − on the pass, then change that entry’s date here.
        </p>
        {hasUndated && (
          <p className={`mt-2 text-sm ${muted}`}>
            Entries counted as already used when a pass was added have no date, so they are not
            listed.
          </p>
        )}
      </div>
    </details>
  )
}
