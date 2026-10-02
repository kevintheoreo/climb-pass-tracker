import { addMonthsToDate, type LocalDate } from './dates'
import { cleanGymName } from './gyms'
import { passInputSchema, userGymInputSchema } from './schemas'
import type { PassFields, PassType } from './types'

/** What the blank row holds while the person is filling it in. Everything is the text typed. */
export interface NewRowDraft {
  gym: string
  passType: PassType
  /** Entries, or for a membership the optional entries per month. Ignored for a single entry. */
  entries: string
  /** `YYYY-MM-DD`, or empty. */
  expiry: string
}

export const BLANK_DRAFT: NewRowDraft = { gym: '', passType: 'multipass', entries: '', expiry: '' }

export type NewRowField = 'gym' | 'entries' | 'expiry'

/** A pass ready to save, except for its gym: `gymText` still has to become a gym (D24). */
export interface NewRowPass {
  gymText: string
  pass: PassFields
}

export type NewRowResult =
  { ok: true; value: NewRowPass } | { ok: false; errors: Partial<Record<NewRowField, string>> }

/** Has anything been typed or picked beyond the blank row? (The default type doesn't count.) */
export function isTouched(draft: NewRowDraft): boolean {
  return draft.gym.trim() !== '' || draft.entries.trim() !== '' || draft.expiry !== ''
}

/**
 * Changing the type clears the entries when their meaning changes ("10 entries" must not silently
 * become "10 a month"), and keeps them between the two counted types.
 */
export function withPassType(draft: NewRowDraft, passType: PassType): NewRowDraft {
  const counted = (t: PassType) => t === 'multipass' || t === 'class_pack'
  const keep = counted(draft.passType) && counted(passType)
  return { ...draft, passType, entries: keep ? draft.entries : '' }
}

/** The +6 / +12 month buttons count from the purchase date, which is today on a new row. */
export function quickExpiry(purchaseDate: LocalDate, months: 6 | 12): LocalDate {
  return addMonthsToDate(purchaseDate, months)
}

const WHOLE_NUMBER = /^\d+$/

/**
 * Checks the blank row (FR-22, FR-54), reporting every problem at once. Nothing here saves
 * anything. A new row is bought today, so `today` is the purchase date.
 */
export function validateNewRow(draft: NewRowDraft, today: LocalDate): NewRowResult {
  const errors: Partial<Record<NewRowField, string>> = {}

  const gymText = cleanGymName(draft.gym)
  const gym = userGymInputSchema.safeParse({ name: gymText })
  if (!gym.success) errors.gym = gym.error.issues[0]?.message ?? 'Enter a gym name'

  const { passType } = draft
  const entriesText = draft.entries.trim()
  const entriesGiven = entriesText !== ''
  let entries: number | null = null
  if (passType !== 'single_entry') {
    if (entriesGiven && !WHOLE_NUMBER.test(entriesText)) {
      errors.entries = 'Enter a whole number'
    } else if (entriesGiven) {
      entries = Number(entriesText)
    } else if (passType !== 'membership') {
      errors.entries = 'Enter the number of entries'
    }
  }

  const expiryOptional = passType === 'single_entry'
  if (draft.expiry === '' && !expiryOptional) errors.expiry = 'Enter an expiry date'

  const common = {
    priceCents: null,
    comments: null,
    purchaseDate: today,
    expiryDate: draft.expiry === '' ? null : draft.expiry,
  }
  const pass: PassFields | null =
    passType === 'membership'
      ? {
          ...common,
          passType,
          expiryDate: draft.expiry,
          monthlyEntries: entries,
          resetDay: null,
        }
      : passType === 'single_entry'
        ? { ...common, passType, totalEntries: 1, initialUsed: 0 }
        : entries === null
          ? null
          : { ...common, passType, expiryDate: draft.expiry, totalEntries: entries, initialUsed: 0 }

  if (pass) {
    const parsed = passInputSchema.safeParse({ ...pass, gymRef: { kind: 'user', id: 'pending' } })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        const field: NewRowField | null =
          path === 'totalEntries' || path === 'monthlyEntries'
            ? 'entries'
            : path === 'expiryDate'
              ? 'expiry'
              : null
        if (field && !errors[field]) {
          errors[field] =
            field === 'expiry' && draft.expiry !== '' && draft.expiry < today
              ? 'Expiry date cannot be before today'
              : issue.message
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { gymText, pass: pass as PassFields } }
}
