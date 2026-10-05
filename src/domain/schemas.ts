import { z } from 'zod'

// zod would otherwise test whether the page may compile code from text (a speed-up it can do without),
// and a strict Content-Security-Policy (netlify.toml) reports that test as a violation. Must come before
// the first schema is built.
z.config({ jitless: true })

/**
 * Input shapes for user-editable records. The row editor validates against these, and the record
 * types in `types.ts` are derived from them so the two can't drift apart.
 */

const date = z.iso.date('Enter a valid date')

export const gymRefSchema = z.object({
  kind: z.enum(['builtin', 'user']),
  id: z.string().min(1),
})

const common = {
  gymRef: gymRefSchema,
  /** Price paid in SGD cents. */
  priceCents: z.number().int().min(0, 'Price cannot be negative').nullable(),
  /** The user's own notes. */
  comments: z.string().trim().max(500, 'Keep comments under 500 characters').nullable(),
  /** Defaults to today; a membership's start date. */
  purchaseDate: date,
}

const entries = (what: string) =>
  z
    .number()
    .int(`Enter a whole number of ${what}`)
    .min(1, `${what[0]?.toUpperCase()}${what.slice(1)} must be at least 1`)
    .max(1000, `Enter 1000 ${what} or fewer`)

const expiryAfterPurchase = (p: { purchaseDate: string; expiryDate: string | null }) =>
  p.expiryDate === null || p.expiryDate >= p.purchaseDate

const expiryMessage = {
  path: ['expiryDate'],
  message: 'Expiry date cannot be before the purchase date',
}

/** Multipass and class / course pack. */
export const countedPassSchema = z
  .object({
    ...common,
    passType: z.enum(['multipass', 'class_pack']),
    totalEntries: entries('entries'),
    /** Entries already used before the pass was added to the app. */
    initialUsed: z.number().int().min(0),
    expiryDate: date,
  })
  .refine(expiryAfterPurchase, expiryMessage)
  .refine((p) => p.initialUsed <= p.totalEntries, {
    path: ['initialUsed'],
    message: 'Cannot be more than the total entries',
  })

/** A pass with exactly one entry. Its expiry is optional. */
export const singleEntrySchema = z
  .object({
    ...common,
    passType: z.literal('single_entry'),
    totalEntries: z.literal(1),
    initialUsed: z.number().int().min(0).max(1),
    expiryDate: date.nullable(),
  })
  .refine(expiryAfterPurchase, expiryMessage)

/**
 * A membership. Unlimited unless `monthlyEntries` is set, in which case it has a monthly allowance
 * that resets on `resetDay` (null means the day of `purchaseDate`). `expiryDate` is its end date
 * before any freezes.
 */
export const membershipSchema = z
  .object({
    ...common,
    passType: z.literal('membership'),
    expiryDate: date,
    monthlyEntries: entries('entries per month').nullable(),
    resetDay: z
      .number()
      .int('Enter a day from 1 to 31')
      .min(1, 'Enter a day from 1 to 31')
      .max(31, 'Enter a day from 1 to 31')
      .nullable(),
  })
  .refine(expiryAfterPurchase, expiryMessage)
  .refine((p) => p.monthlyEntries !== null || p.resetDay === null, {
    path: ['resetDay'],
    message: 'A reset day only applies to a membership with entries per month',
  })

export const passInputSchema = z.discriminatedUnion('passType', [
  countedPassSchema,
  singleEntrySchema,
  membershipSchema,
])

/** A use is just a timestamp: no names and no notes (D4, D26). */
export const useInputSchema = z.object({
  passId: z.string().min(1),
  /** Full ISO timestamp. */
  usedAt: z.iso.datetime({ offset: true }),
})

const freezeRange = z.object({ startDate: date, endDate: date })
const endNotBeforeStart = {
  path: ['endDate'],
  message: 'End date cannot be before the start date',
}

/** Just the dates of a freeze, for edits. */
export const freezeRangeSchema = freezeRange.refine(
  (f) => f.endDate >= f.startDate,
  endNotBeforeStart,
)

export const freezeInputSchema = freezeRange
  .extend({ passId: z.string().min(1) })
  .refine((f) => f.endDate >= f.startDate, endNotBeforeStart)

/** A gym created by typing a new name into a row (D24). */
export const userGymInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a gym name')
    .max(100, 'Keep the gym name under 100 letters'),
})

export const settingsSchema = z.object({
  expiryReminderDays: z.array(z.number().int().min(1).max(365)).max(5),
  lowEntriesThreshold: z.number().int().min(0).max(100),
  expiryRemindersEnabled: z.boolean(),
  lowRemindersEnabled: z.boolean(),
  resetRemindersEnabled: z.boolean(),
  dismissedReminders: z.record(z.string(), z.number().int()),
})

export type GymRef = z.infer<typeof gymRefSchema>
export type PassInput = z.infer<typeof passInputSchema>
export type UseInput = z.infer<typeof useInputSchema>
export type FreezeInput = z.infer<typeof freezeInputSchema>
export type UserGymInput = z.infer<typeof userGymInputSchema>
