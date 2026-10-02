import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
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
 * valid and focus leaves the row, or when Enter is pressed. Until then nothing is saved; the cells
 * that are missing or invalid say so once the person has moved on from the row.
 */
export function NewRow({ gyms, today }: { gyms: GymEntry[]; today: LocalDate }) {
  const [draft, setDraft] = useState<PassDraft>(BLANK_DRAFT)
  const [errors, setErrors] = useState<PassErrors>({})
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState('')
  const saving = useRef(false)
  const gymInput = useRef<HTMLInputElement>(null)

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
  async function submit(refocus: boolean) {
    if (saving.current) return
    if (!isTouched(draft)) {
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
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    e.preventDefault()
    void submit(true)
  }

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
