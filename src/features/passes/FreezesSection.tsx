import { useId, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { buttonClass } from '../../components/formUtils'
import { NotFoundError, repo } from '../../db'
import { formatDate, type LocalDate } from '../../domain/dates'
import { checkFreezeDates, freezeDays, type FreezeErrors } from '../../domain/freezes'
import type { Freeze } from '../../domain/types'
import { Cell, controlClass } from './fields'

const days = (start: LocalDate, end: LocalDate) => {
  const n = freezeDays(start, end)
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** One freeze: two date boxes that save by themselves when valid and left, and Remove. */
function FreezeRow({ freeze, index }: { freeze: Freeze; index: number }) {
  const id = useId()
  const [start, setStart] = useState(freeze.startDate)
  const [end, setEnd] = useState(freeze.endDate)
  const [errors, setErrors] = useState<FreezeErrors>({})
  const [failed, setFailed] = useState(false)

  // The saved freeze changed (this row's own save, or a backup opened): follow it.
  const [seen, setSeen] = useState(freeze)
  if (seen.startDate !== freeze.startDate || seen.endDate !== freeze.endDate) {
    setSeen(freeze)
    setStart(freeze.startDate)
    setEnd(freeze.endDate)
  }

  async function save() {
    if (start === freeze.startDate && end === freeze.endDate) {
      setErrors({})
      return
    }
    const found = checkFreezeDates(start, end)
    setErrors(found)
    if (found.start || found.end) return
    try {
      await repo.updateFreeze(freeze.id, { startDate: start, endDate: end })
      setFailed(false)
    } catch (error) {
      if (!(error instanceof NotFoundError)) setFailed(true)
    }
  }

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    void save()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    e.preventDefault()
    void save()
  }

  const shown = checkFreezeDates(start, end)
  const label = `Freeze ${index + 1}`
  return (
    <li
      aria-label={label}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="rounded-lg border border-stone-300 p-3 dark:border-stone-700"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Cell label="Start" htmlFor={`${id}-start`} error={errors.start} className="min-w-0">
          <input
            id={`${id}-start`}
            type="date"
            value={start}
            aria-invalid={errors.start ? true : undefined}
            onChange={(e) => {
              setStart(e.target.value)
              setErrors({})
            }}
            className={controlClass}
          />
        </Cell>
        <Cell label="End" htmlFor={`${id}-end`} error={errors.end} className="min-w-0">
          <input
            id={`${id}-end`}
            type="date"
            value={end}
            aria-invalid={errors.end ? true : undefined}
            onChange={(e) => {
              setEnd(e.target.value)
              setErrors({})
            }}
            className={controlClass}
          />
        </Cell>
      </div>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {shown.start || shown.end
          ? 'Not saved yet'
          : `${formatDate(start)} to ${formatDate(end)}: ${days(start, end)}`}
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          Couldn’t save this freeze. Try again.
        </p>
      )}
      <div className="mt-3">
        <ConfirmDelete
          label={`Remove ${label.toLowerCase()}`}
          prompt="Remove this freeze? The end date moves back by its length."
          onConfirm={async () => {
            try {
              await repo.deleteFreeze(freeze.id)
            } catch (error) {
              if (!(error instanceof NotFoundError)) throw error
            }
          }}
        />
      </div>
    </li>
  )
}

/** The form that adds a freeze: a start and an end, then Add. */
function AddFreeze({
  passId,
  today,
  onDone,
}: {
  passId: string
  today: LocalDate
  onDone: () => void
}) {
  const id = useId()
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState('')
  const [errors, setErrors] = useState<FreezeErrors>({})
  const [failed, setFailed] = useState(false)

  async function add() {
    const found = checkFreezeDates(start, end)
    setErrors(found)
    if (found.start || found.end) return
    try {
      await repo.addFreeze({ passId, startDate: start, endDate: end })
      onDone()
    } catch {
      setFailed(true)
    }
  }

  return (
    <div
      role="group"
      aria-label="Add a freeze"
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
        e.preventDefault()
        void add()
      }}
      className="rounded-lg border border-dashed border-stone-400 p-3 dark:border-stone-600"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Cell label="Start" htmlFor={`${id}-start`} error={errors.start} className="min-w-0">
          <input
            id={`${id}-start`}
            type="date"
            value={start}
            aria-invalid={errors.start ? true : undefined}
            onChange={(e) => {
              setStart(e.target.value)
              setErrors({})
            }}
            className={controlClass}
          />
        </Cell>
        <Cell label="End" htmlFor={`${id}-end`} error={errors.end} className="min-w-0">
          <input
            id={`${id}-end`}
            type="date"
            value={end}
            aria-invalid={errors.end ? true : undefined}
            onChange={(e) => {
              setEnd(e.target.value)
              setErrors({})
            }}
            className={controlClass}
          />
        </Cell>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          Couldn’t save this freeze. Try again.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => void add()} className={buttonClass('primary')}>
          Add freeze
        </button>
        <button type="button" onClick={onDone} className={buttonClass('secondary')}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Freezes for a membership (FR-20, P1): dates when the membership was paused. Each freeze pushes
 * the end date back by its length; several are allowed, each can be edited or removed, and the
 * monthly reset day does not move (D32). The row's Expiry shows the end date with the freezes
 * included.
 */
export function FreezesSection({
  passId,
  freezes,
  endsOn,
  today,
}: {
  passId: string
  freezes: Freeze[]
  /** The end date with the freezes counted in. */
  endsOn: LocalDate | null
  today: LocalDate
}) {
  const [adding, setAdding] = useState(false)
  const sorted = [...freezes].sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <section aria-labelledby={`${passId}-freezes`} className="mt-4">
      <h4 id={`${passId}-freezes`} className="text-base font-semibold">
        Freezes
      </h4>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        Pause the membership and its end date moves back by the days frozen.
        {endsOn && freezes.length > 0 && ` It now ends on ${formatDate(endsOn)}.`}
      </p>
      {sorted.length > 0 && (
        <ul aria-label="Freezes" className="mb-3 flex flex-col gap-3">
          {sorted.map((freeze, i) => (
            <FreezeRow key={freeze.id} freeze={freeze} index={i} />
          ))}
        </ul>
      )}
      {adding ? (
        <AddFreeze passId={passId} today={today} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={buttonClass('secondary')}>
          Add a freeze
        </button>
      )}
    </section>
  )
}
