import { useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import { PASS_TYPE_LABELS } from '../../domain/labels'
import {
  BLANK_DRAFT,
  isTouched,
  quickExpiry,
  validateNewRow,
  withPassType,
  type NewRowDraft,
  type NewRowField,
} from '../../domain/newRow'
import type { PassType } from '../../domain/types'
import { WIDE_COLUMNS } from './PassRow'
import { GymCombobox } from './GymCombobox'

const PASS_TYPES: PassType[] = ['multipass', 'class_pack', 'membership', 'single_entry']

const controlClass =
  'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-400'

type Errors = Partial<Record<NewRowField, string>>

function Cell({
  label,
  htmlFor,
  error,
  errorId,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string | undefined
  errorId?: string
  className: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
          {label}
        </label>
      ) : (
        <span className="mb-1 block text-sm font-medium">{label}</span>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The blank row at the bottom of the list (FR-15, FR-54, D29). It saves itself once every cell is
 * valid and focus leaves the row, or when Enter is pressed. Until then nothing is saved; the cells
 * that are missing or invalid say so once the person has moved on from the row.
 */
export function NewRow({ gyms, today }: { gyms: GymEntry[]; today: LocalDate }) {
  const [draft, setDraft] = useState<NewRowDraft>(BLANK_DRAFT)
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState('')
  const saving = useRef(false)
  const gymInput = useRef<HTMLInputElement>(null)

  const update = (changes: Partial<NewRowDraft>) => {
    setDraft((d) => ({ ...d, ...changes }))
    setFailed(false)
    // Fix-as-you-go: a message goes away as soon as its cell is edited.
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(changes) as (keyof NewRowDraft)[]) {
        if (key === 'gym' || key === 'entries' || key === 'expiry') delete next[key]
      }
      return next
    })
  }

  /** Saves the row if it is complete; otherwise shows what is missing or wrong. Never saves twice. */
  async function submit(refocus: boolean) {
    if (saving.current) return
    if (!isTouched(draft)) {
      setErrors({})
      return
    }
    const result = validateNewRow(draft, today)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    saving.current = true
    try {
      await repo.createPassForGymText(result.value.gymText, result.value.pass)
      setDraft(BLANK_DRAFT)
      setErrors({})
      setFailed(false)
      setAdded(`Added ${result.value.gymText}, ${PASS_TYPE_LABELS[draft.passType]}`)
      if (refocus) gymInput.current?.focus()
    } catch {
      setFailed(true)
    } finally {
      saving.current = false
    }
  }

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    // Moving between the row's own cells is not leaving the row.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    void submit(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const target = e.target
    if (e.key !== 'Enter' || !(target instanceof HTMLInputElement)) return
    e.preventDefault()
    void submit(true)
  }

  const single = draft.passType === 'single_entry'
  const membership = draft.passType === 'membership'
  const entriesLabel = membership ? 'Entries per month' : 'Entries'
  const expiryLabel = single ? 'Expiry (optional)' : 'Expiry'

  return (
    <section
      aria-labelledby="new-row-heading"
      className="mt-4 rounded-lg border border-dashed border-slate-400 bg-white p-4 dark:border-slate-600 dark:bg-slate-900"
    >
      <h2 id="new-row-heading" className="text-base font-semibold">
        Add a pass
      </h2>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Fill in the row. It saves when every cell is filled in and you move on, or when you press
        Enter.
      </p>
      <form
        noValidate
        aria-label="New pass"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onSubmit={(e) => e.preventDefault()}
        className={`grid grid-cols-2 gap-x-3 gap-y-3 sm:items-start ${WIDE_COLUMNS}`}
      >
        <Cell label="Gym" className="col-span-2 sm:col-span-1">
          <GymCombobox
            value={draft.gym}
            onChange={(gym) => update({ gym })}
            gyms={gyms}
            error={errors.gym}
            inputRef={gymInput}
          />
        </Cell>

        <Cell label="Type" htmlFor="new-row-type" className="min-w-0">
          <select
            id="new-row-type"
            value={draft.passType}
            onChange={(e) => {
              setDraft((d) => withPassType(d, e.target.value as PassType))
              setErrors(({ gym }) => (gym ? { gym } : {}))
              setFailed(false)
            }}
            className={controlClass}
          >
            {PASS_TYPES.map((type) => (
              <option key={type} value={type}>
                {PASS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Cell>

        <Cell
          label={entriesLabel}
          htmlFor="new-row-entries"
          error={errors.entries}
          errorId="new-row-entries-error"
          className="min-w-0 sm:order-last"
        >
          <input
            id="new-row-entries"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={single}
            value={single ? '1' : draft.entries}
            placeholder={membership ? 'Unlimited' : ''}
            aria-invalid={errors.entries ? true : undefined}
            aria-describedby={errors.entries ? 'new-row-entries-error' : undefined}
            onChange={(e) => update({ entries: e.target.value })}
            className={controlClass}
          />
        </Cell>

        <Cell
          label={expiryLabel}
          htmlFor="new-row-expiry"
          error={errors.expiry}
          errorId="new-row-expiry-error"
          className="col-span-2 sm:col-span-1"
        >
          <input
            id="new-row-expiry"
            type="date"
            value={draft.expiry}
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={errors.expiry ? 'new-row-expiry-error' : undefined}
            onChange={(e) => update({ expiry: e.target.value })}
            className={controlClass}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {([6, 12] as const).map((months) => (
              <button
                key={months}
                type="button"
                // mousedown would move focus off the row and look like leaving it.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => update({ expiry: quickExpiry(today, months) })}
                className={buttonClass('secondary')}
              >
                +{months} months
              </button>
            ))}
          </div>
        </Cell>
      </form>

      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          Couldn’t save this pass. Try again.
        </p>
      )}
      <p role="status" className="sr-only">
        {added}
      </p>
    </section>
  )
}
