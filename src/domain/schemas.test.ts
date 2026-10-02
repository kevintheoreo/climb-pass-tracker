import { freezeInputSchema, passInputSchema, useInputSchema, userGymInputSchema } from './schemas'

const gymRef = { kind: 'builtin', id: 'g1' } as const
const counted = {
  gymRef,
  passType: 'multipass',
  name: '10-Pass',
  priceCents: 12000,
  notes: null,
  totalEntries: 10,
  initialUsed: 0,
  purchaseDate: '2026-01-01',
  expiryDate: '2026-07-01',
} as const

const messages = (input: unknown) => {
  const r = passInputSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('passInputSchema', () => {
  it('accepts a valid multipass, class pack, membership and single entry', () => {
    expect(passInputSchema.safeParse(counted).success).toBe(true)
    expect(passInputSchema.safeParse({ ...counted, passType: 'class_pack' }).success).toBe(true)
    expect(
      passInputSchema.safeParse({
        gymRef,
        passType: 'membership',
        name: 'Monthly',
        priceCents: null,
        notes: null,
        billingPeriod: 'monthly',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      }).success,
    ).toBe(true)
    expect(
      passInputSchema.safeParse({
        gymRef,
        passType: 'single_entry',
        name: 'Day pass',
        priceCents: 2200,
        notes: null,
        visitDate: '2026-10-01',
      }).success,
    ).toBe(true)
  })

  it('requires at least 1 entry (FR-22)', () => {
    expect(messages({ ...counted, totalEntries: 0 })).toEqual([
      'totalEntries: Entries must be at least 1',
    ])
  })

  it('rejects an expiry before the purchase date (FR-22) but allows the same day', () => {
    expect(messages({ ...counted, expiryDate: '2025-12-31' })).toEqual([
      'expiryDate: Expiry date cannot be before the purchase date',
    ])
    expect(messages({ ...counted, expiryDate: '2026-01-01' })).toEqual([])
  })

  it('rejects more entries already used than the total, but allows all of them', () => {
    expect(messages({ ...counted, initialUsed: 11 })).toEqual([
      'initialUsed: Cannot be more than the total entries',
    ])
    expect(messages({ ...counted, initialUsed: 10 })).toEqual([])
  })

  it('rejects a membership ending before it starts', () => {
    const m = {
      gymRef,
      passType: 'membership',
      name: 'M',
      priceCents: null,
      notes: null,
      billingPeriod: 'custom',
      startDate: '2026-10-10',
      endDate: '2026-10-09',
    }
    expect(messages(m)).toEqual(['endDate: End date cannot be before the start date'])
  })

  it('rejects blank names, negative or fractional prices and impossible dates', () => {
    expect(messages({ ...counted, name: '   ' })).toEqual(['name: Enter a name'])
    expect(messages({ ...counted, priceCents: -1 })).toHaveLength(1)
    expect(messages({ ...counted, priceCents: 10.5 })).toHaveLength(1)
    expect(messages({ ...counted, purchaseDate: '2026-02-30' })).not.toEqual([])
    expect(messages({ ...counted, passType: 'bogus' })).not.toEqual([])
  })
})

describe('useInputSchema and freezeInputSchema', () => {
  it('accepts UTC and offset timestamps and rejects other strings', () => {
    const use = { passId: 'p', note: null }
    expect(useInputSchema.safeParse({ ...use, usedAt: new Date().toISOString() }).success).toBe(
      true,
    )
    expect(useInputSchema.safeParse({ ...use, usedAt: '2026-10-01T09:00:00+08:00' }).success).toBe(
      true,
    )
    expect(useInputSchema.safeParse({ ...use, usedAt: '2026-10-01' }).success).toBe(false)
  })

  it('has no field for a person, so names cannot be stored (D4)', () => {
    expect(Object.keys(useInputSchema.shape).sort()).toEqual(['note', 'passId', 'usedAt'])
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
  it('accepts a name with no website, or with an http(s) address', () => {
    expect(userGymInputSchema.safeParse({ name: 'My Wall', website: null }).success).toBe(true)
    expect(
      userGymInputSchema.safeParse({ name: 'My Wall', website: 'https://example.com/path' })
        .success,
    ).toBe(true)
    expect(
      userGymInputSchema.safeParse({ name: 'My Wall', website: 'http://example.com' }).success,
    ).toBe(true)
  })

  it('rejects a blank name and web addresses that are not http(s) URLs', () => {
    expect(userGymInputSchema.safeParse({ name: ' ', website: null }).success).toBe(false)
    for (const website of [
      'example.com',
      'not a url',
      'javascript:alert(1)',
      'ftp://example.com',
      '',
    ]) {
      expect(userGymInputSchema.safeParse({ name: 'My Wall', website }).success).toBe(false)
    }
  })
})
