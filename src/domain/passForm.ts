import { addMonthsToDate, type LocalDate } from './dates'
import { cleanGymName, normalizeGymName } from './gyms'
import { centsToInput, parseSgd } from './money'
import { passInputSchema, userGymInputSchema } from './schemas'
import { isMembership, isMonthly, type Pass, type PassFields, type PassType } from './types'

/**
 * The text boxes of a pass, as typed. The blank row at the bottom of the list and the details
 * panel of an existing row share this shape, and the same checks (FR-22), so they can't disagree.
 */
export interface PassDraft {
  gym: string
  passType: PassType
  /** Entries, or for a membership the optional entries per month. Ignored for a single entry. */
  entries: string
  /** `YYYY-MM-DD`, or empty. */
  expiry: string
  /** `YYYY-MM-DD`. The blank row always buys today, so it leaves this empty. */
  purchaseDate: string
  /** SGD, as typed. Empty means no price. */
  price: string
  /** Counted passes and single entries: entries used before the pass was added. Empty is 0. */
  usedBefore: string
  /** Memberships with entries per month: entries already used this month. Empty is 0. */
  usedThisMonth: string
  /** Memberships with entries per month: 1 to 31. Empty means the purchase day. */
  resetDay: string
  comments: string
}

export type PassField =
  | 'gym'
  | 'entries'
  | 'expiry'
  | 'purchaseDate'
  | 'price'
  | 'usedBefore'
  | 'usedThisMonth'
  | 'resetDay'
  | 'comments'

export type PassErrors = Partial<Record<PassField, string>>

export const BLANK_DRAFT: PassDraft = {
  gym: '',
  passType: 'multipass',
  entries: '',
  expiry: '',
  purchaseDate: '',
  price: '',
  usedBefore: '',
  usedThisMonth: '',
  resetDay: '',
  comments: '',
}

/** A pass ready to save, except for its gym: `gymText` still has to become a gym (D24). */
export interface ValidPass {
  gymText: string
  pass: PassFields
  /** Memberships with entries per month only: the count typed into "already used this month". */
  usedThisMonth: number | null
}

export type PassFormResult = { ok: true; value: ValidPass } | { ok: false; errors: PassErrors }

const counted = (t: PassType) => t === 'multipass' || t === 'class_pack'

/** Has anything been typed or picked on the blank row? (The default type doesn't count.) */
export function isTouched(draft: PassDraft): boolean {
  return draft.gym.trim() !== '' || draft.entries.trim() !== '' || draft.expiry !== ''
}

const tidy = (text: string) => text.trim()

/** Do two prices mean the same amount? ("120.5" and "120.50" do.) */
function samePrice(a: string, b: string): boolean {
  const x = parseSgd(a)
  const y = parseSgd(b)
  return x.ok && y.ok ? x.cents === y.cents : tidy(a) === tidy(b)
}

/**
 * Has the person changed anything since the draft was made from the saved pass? Differences that
 * save to the same thing don't count (spacing, the case of a gym name, "120.5" vs "120.50"), so a
 * saved row doesn't look edited again.
 */
export function isChanged(draft: PassDraft, original: PassDraft): boolean {
  return (Object.keys(original) as (keyof PassDraft)[]).some((key) => {
    if (key === 'gym') return normalizeGymName(draft.gym) !== normalizeGymName(original.gym)
    if (key === 'price') return !samePrice(draft.price, original.price)
    return tidy(draft[key]) !== tidy(original[key])
  })
}

/**
 * The saved pass changed underneath an open form (a `−` tap, or this form's own save). Boxes the
 * person has not touched follow the new saved value; boxes they are editing keep what they typed.
 */
export function mergeDraft(draft: PassDraft, before: PassDraft, after: PassDraft): PassDraft {
  const merged = { ...draft }
  for (const key of Object.keys(after) as (keyof PassDraft)[]) {
    if (draft[key] === before[key]) (merged[key] as string) = after[key]
  }
  return merged
}

/**
 * Changing the type clears the entries when their meaning changes ("10 entries" must not silently
 * become "10 a month"), and keeps them between the two counted types.
 */
export function withPassType(draft: PassDraft, passType: PassType): PassDraft {
  const keep = counted(draft.passType) && counted(passType)
  return { ...draft, passType, entries: keep ? draft.entries : '' }
}

/** The +6 / +12 month buttons count from the purchase date. */
export function quickExpiry(purchaseDate: LocalDate, months: 6 | 12): LocalDate {
  return addMonthsToDate(purchaseDate, months)
}

/** A membership with entries per month: it has a monthly count and a reset day. */
export function hasMonthlyAllowance(draft: PassDraft): boolean {
  return draft.passType === 'membership' && draft.entries.trim() !== ''
}

const WHOLE_NUMBER = /^\d+$/

/** Empty is 0; anything else must be a whole number. */
function parseCount(text: string): number | null {
  const t = text.trim()
  if (t === '') return 0
  return WHOLE_NUMBER.test(t) ? Number(t) : null
}

/**
 * Checks a pass form (FR-22), reporting every problem at once. Nothing here saves anything.
 * `adding` is the blank row: it buys the pass today and has no details yet.
 */
export function validatePassDraft(
  draft: PassDraft,
  { today, adding }: { today: LocalDate; adding: boolean },
): PassFormResult {
  const errors: PassErrors = {}
  const { passType } = draft
  const purchaseDate = adding ? today : draft.purchaseDate

  const gymText = cleanGymName(draft.gym)
  const gym = userGymInputSchema.safeParse({ name: gymText })
  if (!gym.success) errors.gym = gym.error.issues[0]?.message ?? 'Enter a gym name'

  const entriesText = draft.entries.trim()
  let entries: number | null = null
  if (passType !== 'single_entry') {
    if (entriesText !== '' && !WHOLE_NUMBER.test(entriesText)) {
      errors.entries = 'Enter a whole number'
    } else if (entriesText !== '') {
      entries = Number(entriesText)
    } else if (passType !== 'membership') {
      errors.entries = 'Enter the number of entries'
    }
  }

  const expiryOptional = passType === 'single_entry'
  if (draft.expiry === '' && !expiryOptional) errors.expiry = 'Enter an expiry date'

  if (purchaseDate === '') errors.purchaseDate = 'Enter the purchase date'

  const price = parseSgd(draft.price)
  if (!price.ok) errors.price = 'Enter an amount like 120 or 120.50'

  const monthly = hasMonthlyAllowance(draft)
  let usedBefore = 0
  if (!adding && (counted(passType) || passType === 'single_entry')) {
    const n = parseCount(draft.usedBefore)
    if (n === null) errors.usedBefore = 'Enter a whole number'
    else usedBefore = n
  }
  let usedThisMonth: number | null = null
  if (!adding && monthly) {
    const n = parseCount(draft.usedThisMonth)
    if (n === null) errors.usedThisMonth = 'Enter a whole number'
    else if (entries !== null && n > entries) {
      errors.usedThisMonth = 'Cannot be more than the entries per month'
    } else usedThisMonth = n
  }
  let resetDay: number | null = null
  if (!adding && monthly && draft.resetDay.trim() !== '') {
    const t = draft.resetDay.trim()
    if (!WHOLE_NUMBER.test(t)) errors.resetDay = 'Enter a day from 1 to 31'
    else resetDay = Number(t)
  }

  const comments = draft.comments.trim() === '' ? null : draft.comments
  const common = {
    priceCents: price.ok ? price.cents : null,
    comments,
    purchaseDate,
    expiryDate: draft.expiry === '' ? null : draft.expiry,
  }
  const pass: PassFields | null =
    passType === 'membership'
      ? { ...common, passType, expiryDate: draft.expiry, monthlyEntries: entries, resetDay }
      : passType === 'single_entry'
        ? { ...common, passType, totalEntries: 1, initialUsed: usedBefore }
        : entries === null
          ? null
          : {
              ...common,
              passType,
              expiryDate: draft.expiry,
              totalEntries: entries,
              initialUsed: usedBefore,
            }

  if (pass) {
    // With no purchase date to compare against, still check the other cells (all problems at once).
    const parsed = passInputSchema.safeParse({
      ...pass,
      purchaseDate: purchaseDate || today,
      gymRef: { kind: 'user', id: 'pending' },
    })
    if (!parsed.success) {
      const fieldOf: Record<string, PassField> = {
        totalEntries: 'entries',
        monthlyEntries: 'entries',
        expiryDate: 'expiry',
        purchaseDate: 'purchaseDate',
        priceCents: 'price',
        initialUsed: 'usedBefore',
        resetDay: 'resetDay',
        comments: 'comments',
      }
      for (const issue of parsed.error.issues) {
        const field = fieldOf[String(issue.path[0])]
        if (!field || errors[field]) continue
        if (purchaseDate === '' && (field === 'purchaseDate' || field === 'expiry')) continue
        if (field === 'usedBefore' && passType === 'single_entry') {
          errors.usedBefore = 'Cannot be more than the total entries'
        } else if (field === 'expiry' && adding && draft.expiry !== '' && draft.expiry < today) {
          errors.expiry = 'Expiry date cannot be before today'
        } else {
          errors[field] = issue.message
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { gymText, pass: pass as PassFields, usedThisMonth } }
}

/** What a saved pass looks like in the form, for the details panel. */
export function draftFromPass(pass: Pass, gymName: string, usedThisMonth: number): PassDraft {
  const base = {
    gym: gymName,
    passType: pass.passType,
    purchaseDate: pass.purchaseDate,
    price: centsToInput(pass.priceCents),
    comments: pass.comments ?? '',
    usedBefore: '',
    usedThisMonth: '',
    resetDay: '',
  }
  if (isMembership(pass)) {
    return {
      ...base,
      entries: pass.monthlyEntries === null ? '' : String(pass.monthlyEntries),
      expiry: pass.expiryDate,
      usedThisMonth: isMonthly(pass) ? String(usedThisMonth) : '',
      resetDay: pass.resetDay === null ? '' : String(pass.resetDay),
    }
  }
  return {
    ...base,
    entries: pass.passType === 'single_entry' ? '' : String(pass.totalEntries),
    expiry: pass.expiryDate ?? '',
    usedBefore: String(pass.initialUsed),
  }
}
