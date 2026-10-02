import {
  freezeInputSchema,
  passInputSchema,
  settingsSchema,
  useInputSchema,
  userGymInputSchema,
} from './schemas'
import { DEFAULT_SETTINGS } from './settings'

const gymRef = { kind: 'builtin', id: 'g1' } as const
const common = { gymRef, priceCents: 12000, comments: null, purchaseDate: '2026-01-01' }

const multipass = {
  ...common,
  passType: 'multipass',
  totalEntries: 10,
  initialUsed: 0,
  expiryDate: '2026-07-01',
} as const
const single = {
  ...common,
  passType: 'single_entry',
  totalEntries: 1,
  initialUsed: 0,
  expiryDate: null,
} as const
const membership = {
  ...common,
  passType: 'membership',
  expiryDate: '2026-12-31',
  monthlyEntries: null,
  resetDay: null,
} as const

const messages = (input: unknown) => {
  const r = passInputSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('passInputSchema', () => {
  it('accepts each kind of pass', () => {
    expect(messages(multipass)).toEqual([])
    expect(messages({ ...multipass, passType: 'class_pack', totalEntries: 4 })).toEqual([])
    expect(messages(single)).toEqual([])
    expect(messages(membership)).toEqual([])
    expect(messages({ ...membership, monthlyEntries: 8, resetDay: 15 })).toEqual([])
    expect(messages({ ...membership, monthlyEntries: 8 })).toEqual([]) // reset day: purchase day
  })

  it('has no name, billing period or visit date any more', () => {
    const parsed = passInputSchema.parse({
      ...multipass,
      name: '10-Pass',
      billingPeriod: 'monthly',
    })
    expect(parsed).not.toHaveProperty('name')
    expect(parsed).not.toHaveProperty('billingPeriod')
  })

  it('requires at least 1 entry (FR-22)', () => {
    expect(messages({ ...multipass, totalEntries: 0 })).toEqual([
      'totalEntries: Entries must be at least 1',
    ])
    expect(messages({ ...multipass, totalEntries: 1001 })).toEqual([
      'totalEntries: Enter 1000 entries or fewer',
    ])
    expect(messages({ ...multipass, totalEntries: 2.5 })).toHaveLength(1)
  })

  it('rejects an expiry before the purchase date (FR-22) but allows the same day', () => {
    expect(messages({ ...multipass, expiryDate: '2025-12-31' })).toEqual([
      'expiryDate: Expiry date cannot be before the purchase date',
    ])
    expect(messages({ ...multipass, expiryDate: '2026-01-01' })).toEqual([])
    expect(messages({ ...membership, expiryDate: '2025-12-31' })).toEqual([
      'expiryDate: Expiry date cannot be before the purchase date',
    ])
    expect(messages({ ...single, expiryDate: '2025-12-31' })).toEqual([
      'expiryDate: Expiry date cannot be before the purchase date',
    ])
  })

  it('requires an expiry for everything except a single entry (FR-17)', () => {
    expect(messages({ ...multipass, expiryDate: null })).not.toEqual([])
    expect(messages({ ...membership, expiryDate: null })).not.toEqual([])
    expect(messages({ ...single, expiryDate: null })).toEqual([])
  })

  it('rejects more entries already used than the total, but allows all of them', () => {
    expect(messages({ ...multipass, initialUsed: 11 })).toEqual([
      'initialUsed: Cannot be more than the total entries',
    ])
    expect(messages({ ...multipass, initialUsed: 10 })).toEqual([])
    expect(messages({ ...single, initialUsed: 1 })).toEqual([])
    expect(messages({ ...single, initialUsed: 2 })).not.toEqual([])
  })

  it('a single entry has exactly one entry', () => {
    expect(messages({ ...single, totalEntries: 2 })).not.toEqual([])
  })

  it('checks entries per month and the reset day on a membership (FR-22, FR-58)', () => {
    expect(messages({ ...membership, monthlyEntries: 0 })).toEqual([
      'monthlyEntries: Entries per month must be at least 1',
    ])
    expect(messages({ ...membership, monthlyEntries: 8, resetDay: 0 })).toEqual([
      'resetDay: Enter a day from 1 to 31',
    ])
    expect(messages({ ...membership, monthlyEntries: 8, resetDay: 32 })).toEqual([
      'resetDay: Enter a day from 1 to 31',
    ])
    expect(messages({ ...membership, monthlyEntries: 8, resetDay: 31 })).toEqual([])
    expect(messages({ ...membership, monthlyEntries: 8, resetDay: 1 })).toEqual([])
    // A reset day only means something when there is a monthly allowance.
    expect(messages({ ...membership, monthlyEntries: null, resetDay: 15 })).toEqual([
      'resetDay: A reset day only applies to a membership with entries per month',
    ])
  })

  it('reports every problem at once', () => {
    const problems = messages({
      ...multipass,
      totalEntries: 0,
      priceCents: -5,
      expiryDate: '2025-01-01',
    })
    expect(problems).toHaveLength(3)
  })

  it('rejects negative or fractional prices, long comments, impossible dates and unknown types', () => {
    expect(messages({ ...multipass, priceCents: -1 })).toHaveLength(1)
    expect(messages({ ...multipass, priceCents: 10.5 })).toHaveLength(1)
    expect(messages({ ...multipass, comments: 'x'.repeat(501) })).toEqual([
      'comments: Keep comments under 500 characters',
    ])
    expect(messages({ ...multipass, purchaseDate: '2026-02-30' })).not.toEqual([])
    expect(messages({ ...multipass, passType: 'bogus' })).not.toEqual([])
  })
})

describe('useInputSchema and freezeInputSchema', () => {
  it('accepts UTC and offset timestamps and rejects other strings', () => {
    expect(
      useInputSchema.safeParse({ passId: 'p', usedAt: new Date().toISOString() }).success,
    ).toBe(true)
    expect(
      useInputSchema.safeParse({ passId: 'p', usedAt: '2026-10-01T09:00:00+08:00' }).success,
    ).toBe(true)
    expect(useInputSchema.safeParse({ passId: 'p', usedAt: '2026-10-01' }).success).toBe(false)
  })

  it('has no field for a person or a note, so neither can be stored (D4, D26)', () => {
    expect(Object.keys(useInputSchema.shape).sort()).toEqual(['passId', 'usedAt'])
  })

  it('rejects a freeze that ends before it starts', () => {
    expect(
      freezeInputSchema.safeParse({ passId: 'p', startDate: '2026-10-05', endDate: '2026-10-04' })
        .success,
    ).toBe(false)
    expect(
      freezeInputSchema.safeParse({ passId: 'p', startDate: '2026-10-05', endDate: '2026-10-05' })
        .success,
    ).toBe(true)
  })
})

describe('userGymInputSchema', () => {
  it('needs a name and nothing else', () => {
    expect(userGymInputSchema.safeParse({ name: 'My Wall' }).success).toBe(true)
    expect(userGymInputSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(userGymInputSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false)
    expect(Object.keys(userGymInputSchema.shape)).toEqual(['name'])
  })
})

describe('settingsSchema', () => {
  it('accepts the defaults and rejects nonsense', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, lowEntriesThreshold: -1 }).success).toBe(
      false,
    )
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, expiryReminderDays: [0] }).success).toBe(
      false,
    )
    expect(
      settingsSchema.safeParse({ ...DEFAULT_SETTINGS, resetRemindersEnabled: 'yes' }).success,
    ).toBe(false)
  })
})
