import { useId, type Ref } from 'react'
import { buttonClass } from '../../components/formUtils'
import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import { PASS_TYPE_LABELS } from '../../domain/labels'
import {
  hasMonthlyAllowance,
  quickExpiry,
  type PassDraft,
  type PassErrors,
} from '../../domain/passForm'
import type { PassType } from '../../domain/types'
import { Cell, controlClass, WIDE_COLUMNS } from './fields'
import { GymCombobox } from './GymCombobox'

const PASS_TYPES: PassType[] = ['multipass', 'class_pack', 'membership', 'single_entry']

/**
 * The cells of a pass: Gym, Type, Entries and Expiry in the row's own columns, and with `details`
 * also the purchase date, price, already used, reset day and comments (FR-17). The blank row and
 * the details panel of an existing row both use it, so they look and check the same.
 */
export function PassForm({
  draft,
  errors,
  onChange,
  onTypeChange,
  gyms,
  quickFrom,
  details,
  gymInputRef,
}: {
  draft: PassDraft
  errors: PassErrors
  onChange: (changes: Partial<PassDraft>) => void
  onTypeChange: (type: PassType) => void
  gyms: GymEntry[]
  /** The date the +6 / +12 month buttons count from: the purchase date. */
  quickFrom: LocalDate
  details: boolean
  gymInputRef?: Ref<HTMLInputElement>
}) {
  const id = useId()
  const single = draft.passType === 'single_entry'
  const membership = draft.passType === 'membership'
  const monthly = hasMonthlyAllowance(draft)
  const err = (field: keyof PassErrors) => (errors[field] ? `${id}-${field}-error` : undefined)

  return (
    <>
      <div className={`grid grid-cols-2 gap-x-3 gap-y-3 sm:items-start ${WIDE_COLUMNS}`}>
        <Cell label="Gym" className="col-span-2 sm:col-span-1">
          <GymCombobox
            value={draft.gym}
            onChange={(gym) => onChange({ gym })}
            gyms={gyms}
            error={errors.gym}
            inputRef={gymInputRef}
          />
        </Cell>

        <Cell label="Type" htmlFor={`${id}-type`} className="min-w-0">
          <select
            id={`${id}-type`}
            value={draft.passType}
            onChange={(e) => onTypeChange(e.target.value as PassType)}
            className={`${controlClass} px-2`}
          >
            {PASS_TYPES.map((type) => (
              <option key={type} value={type}>
                {PASS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Cell>

        <Cell
          label={membership ? 'Entries per month' : 'Entries'}
          htmlFor={`${id}-entries`}
          error={errors.entries}
          errorId={err('entries')}
          className="min-w-0 sm:order-last"
        >
          <input
            id={`${id}-entries`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={single}
            value={single ? '1' : draft.entries}
            placeholder={membership ? 'Unlimited' : ''}
            aria-invalid={errors.entries ? true : undefined}
            aria-describedby={err('entries')}
            onChange={(e) => onChange({ entries: e.target.value })}
            className={controlClass}
          />
        </Cell>

        <Cell
          label={single ? 'Expiry (optional)' : 'Expiry'}
          htmlFor={`${id}-expiry`}
          error={errors.expiry}
          errorId={err('expiry')}
          className="col-span-2 sm:col-span-1"
        >
          <input
            id={`${id}-expiry`}
            type="date"
            value={draft.expiry}
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={err('expiry')}
            onChange={(e) => onChange({ expiry: e.target.value })}
            className={controlClass}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {([6, 12] as const).map((months) => (
              <button
                key={months}
                type="button"
                // mousedown would move focus off the form and look like leaving it.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ expiry: quickExpiry(quickFrom, months) })}
                className={buttonClass('secondary')}
              >
                +{months} months
              </button>
            ))}
          </div>
        </Cell>
      </div>

      {details && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 sm:items-start">
          <Cell
            label="Purchase date"
            htmlFor={`${id}-purchase`}
            error={errors.purchaseDate}
            errorId={err('purchaseDate')}
            className="col-span-2 sm:col-span-1"
          >
            <input
              id={`${id}-purchase`}
              type="date"
              value={draft.purchaseDate}
              aria-invalid={errors.purchaseDate ? true : undefined}
              aria-describedby={err('purchaseDate')}
              onChange={(e) => onChange({ purchaseDate: e.target.value })}
              className={controlClass}
            />
          </Cell>

          <Cell
            label="Price paid (S$, optional)"
            htmlFor={`${id}-price`}
            error={errors.price}
            errorId={err('price')}
            className="col-span-2 sm:col-span-1"
          >
            <input
              id={`${id}-price`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="120"
              value={draft.price}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={err('price')}
              onChange={(e) => onChange({ price: e.target.value })}
              className={controlClass}
            />
          </Cell>

          {monthly ? (
            <>
              <Cell
                label="Already used this month"
                htmlFor={`${id}-used-month`}
                error={errors.usedThisMonth}
                errorId={err('usedThisMonth')}
                className="min-w-0"
              >
                <input
                  id={`${id}-used-month`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.usedThisMonth}
                  aria-invalid={errors.usedThisMonth ? true : undefined}
                  aria-describedby={err('usedThisMonth')}
                  onChange={(e) => onChange({ usedThisMonth: e.target.value })}
                  className={controlClass}
                />
              </Cell>
              <Cell
                label="Reset day (1 to 31)"
                htmlFor={`${id}-reset`}
                error={errors.resetDay}
                errorId={err('resetDay')}
                hint="Blank: the day of the purchase date"
                className="min-w-0"
              >
                <input
                  id={`${id}-reset`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.resetDay}
                  aria-invalid={errors.resetDay ? true : undefined}
                  aria-describedby={err('resetDay')}
                  onChange={(e) => onChange({ resetDay: e.target.value })}
                  className={controlClass}
                />
              </Cell>
            </>
          ) : (
            !membership && (
              <Cell
                label="Already used"
                htmlFor={`${id}-used`}
                error={errors.usedBefore}
                errorId={err('usedBefore')}
                hint="Entries used before you added it"
                className="col-span-2 sm:col-span-1"
              >
                <input
                  id={`${id}-used`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.usedBefore}
                  aria-invalid={errors.usedBefore ? true : undefined}
                  aria-describedby={err('usedBefore')}
                  onChange={(e) => onChange({ usedBefore: e.target.value })}
                  className={controlClass}
                />
              </Cell>
            )
          )}

          <Cell
            label="Comments (optional)"
            htmlFor={`${id}-comments`}
            error={errors.comments}
            errorId={err('comments')}
            className="col-span-2 sm:col-span-4"
          >
            <textarea
              id={`${id}-comments`}
              rows={2}
              value={draft.comments}
              aria-invalid={errors.comments ? true : undefined}
              aria-describedby={err('comments')}
              onChange={(e) => onChange({ comments: e.target.value })}
              className={controlClass}
            />
          </Cell>
        </div>
      )}
    </>
  )
}
