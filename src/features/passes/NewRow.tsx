import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import { PASS_TYPE_LABELS } from '../../domain/labels'
import {
  BLANK_DRAFT,
  isTouched,
  validatePassDraft,
  withPassType,
  type PassDraft,
  type PassErrors,
} from '../../domain/passForm'
import { PassForm } from './PassForm'

/**
 * The blank row at the bottom of the list (FR-15, FR-54, D29). It saves itself once every cell is
 * valid and the Add pass button is pressed or Enter is pressed. Leaving the row saves nothing. Until then nothing is saved; the cells
 * that are missing or invalid say so once the person has moved on from the row.
 */
export function NewRow({
  gyms,
  today,
  autoFocus = false,
  initial = BLANK_DRAFT,
  onAdded,
  onClose,
}: {
  gyms: GymEntry[]
  today: LocalDate
  /** Put the cursor in the gym cell when the row appears (it was opened by a button). */
  autoFocus?: boolean
  /** What the row starts with ("Buy again" fills in the gym, type, entries and price). */
  initial?: PassDraft
  /** Called after a pass was saved, with its id. */
  onAdded?: (passId: string) => void
  /** When given, the row has a Close button that hides it again. */
  onClose?: () => void
}) {
  const [draft, setDraft] = useState<PassDraft>(initial)
  const [errors, setErrors] = useState<PassErrors>({})
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState('')
  const saving = useRef(false)
  // The draft that was just saved. Until the blank draft is on screen, a second Enter (or tap on
  // Add pass) still holds this very draft, and must not add the pass again.
  const savedDraft = useRef<PassDraft | null>(null)
  const gymInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) gymInput.current?.focus()
  }, [autoFocus])

  const update = (changes: Partial<PassDraft>) => {
    setDraft((d) => ({ ...d, ...changes }))
    setFailed(false)
    // Fix-as-you-go: a message goes away as soon as its cell is edited.
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(changes) as (keyof PassDraft)[])
        delete next[key as keyof PassErrors]
      return next
    })
  }

  /** Saves the row if it is complete; otherwise shows what is missing or wrong. Never saves twice. */
  async function submit(refocus: boolean, explicit = false) {
    if (saving.current || draft === savedDraft.current) return
    // The Add pass button on an untouched row still says what is missing.
    if (!explicit && !isTouched(draft)) {
      setErrors({})
      return
    }
    const result = validatePassDraft(draft, { today, adding: true })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    saving.current = true
    try {
      const created = await repo.createPassForGymText(result.value.gymText, result.value.pass)
      savedDraft.current = draft
      setDraft(BLANK_DRAFT)
      setErrors({})
      setFailed(false)
      setAdded(`Added ${result.value.gymText}, ${PASS_TYPE_LABELS[draft.passType]}`)
      if (onAdded) onAdded(created.id)
      else if (refocus) gymInput.current?.focus()
    } catch {
      setFailed(true)
    } finally {
      saving.current = false
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    e.preventDefault()
    void submit(true)
  }

  return (
    <section
      aria-labelledby="new-row-heading"
      className="mt-4 rounded-lg border border-dashed border-stone-400 bg-white p-4 dark:border-stone-600 dark:bg-stone-900"
    >
      <h2 id="new-row-heading" className="text-base font-semibold">
        Add a pass
      </h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        Fill in the row and tap Add pass. The price is optional.
      </p>
      <form
        noValidate
        aria-label="New pass"
        onKeyDown={onKeyDown}
        onSubmit={(e) => {
          e.preventDefault()
          void submit(true, true)
        }}
      >
        <PassForm
          draft={draft}
          errors={errors}
          onChange={update}
          onTypeChange={(type) => {
            setDraft((d) => withPassType(d, type))
            setErrors(({ gym }) => (gym ? { gym } : {}))
            setFailed(false)
          }}
          gyms={gyms}
          quickFrom={today}
          details={false}
          gymInputRef={gymInput}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className={buttonClass('primary')}>
            Add pass
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className={buttonClass('secondary')}>
              Cancel
            </button>
          )}
        </div>
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
