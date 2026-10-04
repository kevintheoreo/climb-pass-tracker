import { useId, useRef, useState, type FocusEvent } from 'react'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { buttonClass } from '../../components/formUtils'
import { NotFoundError, repo } from '../../db'
import { currentPeriod, usesInPeriod } from '../../domain/cycle'
import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import {
  buyAgainDraft,
  draftFromPass,
  isChanged,
  mergeDraft,
  validatePassDraft,
  withPassType,
  type PassDraft,
  type PassErrors,
} from '../../domain/passForm'
import type { Row } from '../../domain/rows'
import { isMonthly } from '../../domain/types'
import { FreezesSection } from './FreezesSection'
import { PassForm } from './PassForm'

/** Entries counted as used in the current month, for a monthly membership (else 0). */
function usedThisMonthOf(row: Row, today: LocalDate): number {
  const { pass, bundle } = row
  if (!isMonthly(pass)) return 0
  return usesInPeriod(pass, bundle.uses, currentPeriod(pass, today)).length
}

/**
 * The details panel under a tapped row (FR-17, FR-18, FR-56): every field of the pass, the gym,
 * type, entries and expiry too. Like the blank row it saves itself when everything is valid and
 * focus leaves the panel, or on Enter; a half-finished edit is never saved, and Close drops it.
 * Delete asks first (FR-19).
 */
export function EditPanel({
  id,
  row,
  gyms,
  today,
  onClose,
  onBuyAgain,
}: {
  id: string
  row: Row
  gyms: GymEntry[]
  today: LocalDate
  onClose: () => void
  /** Open the blank row filled in like this pass (FR-21). */
  onBuyAgain: (draft: PassDraft) => void
}) {
  const original = draftFromPass(row.pass, row.gymName, usedThisMonthOf(row, today))
  const [draft, setDraft] = useState<PassDraft>(original)
  const [seen, setSeen] = useState<PassDraft>(original)
  const [errors, setErrors] = useState<PassErrors>({})
  const [failed, setFailed] = useState(false)
  const saving = useRef(false)
  const headingId = useId()

  // The saved pass moved on (a `−` tap, or this panel's own save): boxes not being edited follow it.
  if (JSON.stringify(original) !== JSON.stringify(seen)) {
    setDraft((d) => mergeDraft(d, seen, original))
    setSeen(original)
  }

  const update = (changes: Partial<PassDraft>) => {
    setDraft((d) => ({ ...d, ...changes }))
    setFailed(false)
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(changes)) delete next[key as keyof PassErrors]
      return next
    })
  }

  /** Saves the edit if there is one and it is valid; otherwise shows what is wrong. */
  async function save(): Promise<boolean> {
    if (saving.current) return false
    if (!isChanged(draft, original)) {
      setErrors({})
      return true
    }
    const result = validatePassDraft(draft, { today, adding: false })
    if (!result.ok) {
      setErrors(result.errors)
      return false
    }
    saving.current = true
    try {
      const usedThisMonth =
        draft.usedThisMonth !== original.usedThisMonth ? result.value.usedThisMonth : null
      await repo.saveRow(row.pass.id, result.value.gymText, result.value.pass, {
        usedThisMonth,
        today,
      })
      setErrors({})
      setFailed(false)
      return true
    } catch (error) {
      if (error instanceof NotFoundError)
        onClose() // deleted somewhere else
      else setFailed(true)
      return false
    } finally {
      saving.current = false
    }
  }

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    // Moving between the panel's own cells is not leaving it.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    void save()
  }

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      onBlur={onBlur}
      className="col-span-full mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
    >
      <h3 id={headingId} className="mb-3 text-base font-semibold">
        Details: {row.gymName}, {row.typeLabel}
      </h3>
      <form
        noValidate
        aria-label={`Edit ${row.gymName}, ${row.typeLabel}`}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
          e.preventDefault()
          void save()
        }}
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
          quickFrom={/^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate) ? draft.purchaseDate : today}
          details
        />
      </form>

      {row.pass.passType === 'membership' && (
        <FreezesSection
          passId={row.pass.id}
          freezes={row.bundle.freezes}
          endsOn={row.expiry}
          today={today}
        />
      )}

      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          Couldn’t save your changes. Try again.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={() => {
            // Keep a valid edit; drop a half-finished one.
            void save().then(() => onClose())
          }}
          className={buttonClass('primary')}
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => {
            // Keep a valid edit, then start the new row from what this pass looks like now.
            void save().then((saved) => {
              if (saved) onBuyAgain(buyAgainDraft(row.pass, draft.gym.trim() || row.gymName))
            })
          }}
          className={buttonClass('secondary')}
        >
          Buy again
        </button>
        <ConfirmDelete
          label="Delete this pass"
          prompt="Delete this pass and everything recorded for it? This can’t be undone."
          onConfirm={async () => {
            try {
              await repo.deletePass(row.pass.id)
            } catch (error) {
              if (!(error instanceof NotFoundError)) throw error
            }
            onClose()
          }}
        />
      </div>
    </section>
  )
}
