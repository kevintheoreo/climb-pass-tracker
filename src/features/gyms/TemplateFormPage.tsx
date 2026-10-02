import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ZodError } from 'zod'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { Page } from '../../components/Page'
import { SelectField, TextAreaField, TextField } from '../../components/forms'
import { buttonClass, fieldErrors } from '../../components/formUtils'
import { repo } from '../../db'
import { userTemplateInputSchema } from '../../domain/schemas'
import { BILLING_PERIOD_LABELS, PASS_TYPE_LABELS, type BillingPeriod } from '../../domain/labels'
import { centsToInput, parseSgd } from '../../domain/money'
import type { GymRef, PassType, UserTemplate } from '../../domain/types'
import { useGymData } from './useGymData'

/** '' → null, '12' → 12, anything else (including 2.5) → NaN. */
function parseWhole(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : NaN
}

const PASS_TYPES = Object.keys(PASS_TYPE_LABELS) as PassType[]
const BILLING_PERIODS = Object.keys(BILLING_PERIOD_LABELS) as BillingPeriod[]

function TemplateForm({ gymRef, existing }: { gymRef: GymRef; existing?: UserTemplate }) {
  const navigate = useNavigate()
  const backTo = `/gyms/${gymRef.kind}/${gymRef.id}`
  const [passType, setPassType] = useState<PassType>(existing?.passType ?? 'multipass')
  const [entries, setEntries] = useState(existing?.totalEntries?.toString() ?? '')
  const [billing, setBilling] = useState<BillingPeriod>(existing?.billingPeriod ?? 'monthly')
  const [price, setPrice] = useState(centsToInput(existing?.priceCents ?? null))
  const [validity, setValidity] = useState(existing?.validityMonths?.toString() ?? '')
  const [comments, setComments] = useState(existing?.comments ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const counted = passType === 'multipass' || passType === 'class_pack'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found: Record<string, string> = {}

    const totalEntries = counted ? parseWhole(entries) : null
    if (counted && totalEntries === null) found.totalEntries = 'Enter the number of entries'
    else if (Number.isNaN(totalEntries)) found.totalEntries = 'Enter a whole number'

    const parsedPrice = parseSgd(price)
    if (!parsedPrice.ok) found.priceCents = 'Enter an amount like 120 or 120.50'

    const validityMonths = passType === 'single_entry' ? null : parseWhole(validity)
    if (Number.isNaN(validityMonths)) found.validityMonths = 'Enter a whole number of months'

    const input = {
      gymRef,
      passType,
      // Unreadable numbers are already reported above; null here lets the schema report the rest.
      totalEntries: Number.isNaN(totalEntries) ? null : totalEntries,
      priceCents: parsedPrice.ok ? parsedPrice.cents : null,
      validityMonths: Number.isNaN(validityMonths) ? null : validityMonths,
      billingPeriod: passType === 'membership' ? billing : null,
      comments: comments.trim() === '' ? null : comments,
    }

    // Report every problem at once: the ones found above plus whatever the schema finds.
    const checked = userTemplateInputSchema.safeParse(input)
    const all = { ...(checked.success ? {} : fieldErrors(checked.error)), ...found }
    if (Object.keys(all).length > 0) {
      setErrors(all)
      return
    }

    setSaving(true)
    try {
      if (existing) await repo.updateUserTemplate(existing.id, input)
      else await repo.addUserTemplate(input)
      navigate(backTo, { replace: true })
    } catch (error) {
      if (error instanceof ZodError) setErrors(fieldErrors(error))
      else throw error
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SelectField
        label="Type"
        value={passType}
        onChange={(e) => setPassType(e.target.value as PassType)}
      >
        {PASS_TYPES.map((type) => (
          <option key={type} value={type}>
            {PASS_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      {counted && (
        <TextField
          label={passType === 'class_pack' ? 'Number of sessions' : 'Number of entries'}
          value={entries}
          onChange={(e) => setEntries(e.target.value)}
          error={errors.totalEntries}
          inputMode="numeric"
          autoComplete="off"
        />
      )}
      {passType === 'membership' && (
        <SelectField
          label="Billing period"
          value={billing}
          onChange={(e) => setBilling(e.target.value as BillingPeriod)}
        >
          {BILLING_PERIODS.map((period) => (
            <option key={period} value={period}>
              {BILLING_PERIOD_LABELS[period]}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label="Price in S$ (optional)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        error={errors.priceCents}
        hint="Saved with this option and filled in when you use it."
        inputMode="decimal"
        autoComplete="off"
      />
      {passType !== 'single_entry' && (
        <TextField
          label="Valid for (months, optional)"
          value={validity}
          onChange={(e) => setValidity(e.target.value)}
          error={errors.validityMonths}
          inputMode="numeric"
          autoComplete="off"
        />
      )}
      <TextAreaField
        label="Comments (optional)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        error={errors.comments}
        hint="Only for your own reference, e.g. “shareable with friends”."
      />
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={buttonClass('primary')}>
          {existing ? 'Save changes' : 'Add pass option'}
        </button>
        <Link to={backTo} className={buttonClass('secondary')}>
          Cancel
        </Link>
      </div>
      {existing && (
        <div className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-800">
          <ConfirmDelete
            label="Delete pass option"
            prompt="Delete this pass option? Passes you already added are not affected."
            onConfirm={async () => {
              await repo.deleteUserTemplate(existing.id)
              navigate(backTo, { replace: true })
            }}
          />
        </div>
      )}
    </form>
  )
}

export default function TemplateFormPage() {
  const { kind, id = '', templateId } = useParams()
  const data = useGymData()
  const existing = useLiveQuery(
    async () => (templateId ? ((await repo.getUserTemplate(templateId)) ?? null) : undefined),
    [templateId],
  )

  if (!data || (templateId && existing === undefined)) return <Page title="Pass option" />

  const gym = data.allGyms.find((g) => g.ref.kind === kind && g.ref.id === id)
  const missing = !gym || (templateId && (!existing || existing.gymRef.id !== id))
  if (missing) {
    return (
      <Page title="Not found" back={{ to: '/gyms', label: 'Gyms' }}>
        <p className="text-slate-600 dark:text-slate-400">
          This gym or pass option doesn’t exist, or it can’t be edited.
        </p>
      </Page>
    )
  }

  return (
    <Page
      title={existing ? 'Edit pass option' : 'Add a pass option'}
      back={{ to: `/gyms/${gym.ref.kind}/${gym.ref.id}`, label: gym.name }}
    >
      <TemplateForm gymRef={gym.ref} {...(existing ? { existing } : {})} />
    </Page>
  )
}
