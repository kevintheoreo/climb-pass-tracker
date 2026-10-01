import { z } from 'zod'

/**
 * Input shapes for user-editable records. Forms validate against these, and the record types in
 * `types.ts` are derived from them so the two can't drift apart.
 */

const date = z.iso.date('Enter a valid date')

export const gymRefSchema = z.object({
  kind: z.enum(['builtin', 'user']),
  id: z.string().min(1),
})

const common = {
  gymRef: gymRefSchema,
  name: z.string().trim().min(1, 'Enter a name').max(100),
  /** Price paid in SGD cents. */
  priceCents: z.number().int().min(0, 'Price cannot be negative').nullable(),
  notes: z.string().max(500).nullable(),
}

export const countedPassSchema = z
  .object({
    ...common,
    passType: z.enum(['multipass', 'class_pack']),
    totalEntries: z.number().int().min(1, 'Entries must be at least 1').max(1000),
    /** Entries already used before the pass was added to the app. */
    initialUsed: z.number().int().min(0),
    purchaseDate: date,
    expiryDate: date,
  })
  .refine((p) => p.expiryDate >= p.purchaseDate, {
    path: ['expiryDate'],
    message: 'Expiry date cannot be before the purchase date',
  })
  .refine((p) => p.initialUsed <= p.totalEntries, {
    path: ['initialUsed'],
    message: 'Cannot be more than the total entries',
  })

export const membershipSchema = z
  .object({
    ...common,
    passType: z.literal('membership'),
    billingPeriod: z.enum(['monthly', 'yearly', 'custom']),
    startDate: date,
    /** Base end date, before any freezes are added. */
    endDate: date,
  })
  .refine((p) => p.endDate >= p.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before the start date',
  })

export const singleEntrySchema = z.object({
  ...common,
  passType: z.literal('single_entry'),
  visitDate: date,
})

export const passInputSchema = z.discriminatedUnion('passType', [
  countedPassSchema,
  membershipSchema,
  singleEntrySchema,
])

export const useInputSchema = z.object({
  passId: z.string().min(1),
  /** Full ISO timestamp. */
  usedAt: z.iso.datetime({ offset: true }),
  note: z.string().max(200).nullable(),
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

export const userGymInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  website: z.string().trim().max(200).nullable(),
})

/** A pass template the user saved themselves. Unlike built-in ones, it may carry price and validity (Q3). */
export const userTemplateInputSchema = z
  .object({
    gymRef: gymRefSchema,
    passType: z.enum(['multipass', 'class_pack', 'membership', 'single_entry']),
    name: z.string().trim().min(1, 'Enter a name').max(100),
    totalEntries: z.number().int().min(1).max(1000).nullable(),
    priceCents: z.number().int().min(0).nullable(),
    validityMonths: z.number().int().min(1).max(120).nullable(),
    billingPeriod: z.enum(['monthly', 'yearly', 'custom']).nullable(),
  })
  .refine(
    (t) =>
      t.passType === 'multipass' || t.passType === 'class_pack' ? t.totalEntries !== null : true,
    { path: ['totalEntries'], message: 'Enter the number of entries' },
  )

export const settingsSchema = z.object({
  expiryReminderDays: z.array(z.number().int().min(1).max(365)).max(5),
  lowEntriesThreshold: z.number().int().min(0).max(100),
  expiryRemindersEnabled: z.boolean(),
  lowRemindersEnabled: z.boolean(),
  dismissedReminders: z.record(z.string(), z.number().int()),
})

export type GymRef = z.infer<typeof gymRefSchema>
export type PassInput = z.infer<typeof passInputSchema>
export type UseInput = z.infer<typeof useInputSchema>
export type FreezeInput = z.infer<typeof freezeInputSchema>
export type UserGymInput = z.infer<typeof userGymInputSchema>
export type UserTemplateInput = z.infer<typeof userTemplateInputSchema>
