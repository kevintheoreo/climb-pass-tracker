import { canLogUse, useDate } from './rules'
import { makeCounted, makeFreeze, makeMembership, makeSingle, makeUses } from './testFactories'

const today = '2026-10-01'

describe('canLogUse — counted passes', () => {
  it('allows a normal use today', () => {
    const pass = makeCounted()
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: today, today })).toEqual({
      ok: true,
      frozen: false,
    })
  })

  it('allows a use on the expiry date but not the day after', () => {
    const pass = makeCounted({ expiryDate: '2026-10-01', purchaseDate: '2026-01-01' })
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: '2026-10-01', today }).ok).toBe(true)
    expect(
      canLogUse({ pass, uses: [], freezes: [], onDate: '2026-10-02', today: '2026-10-02' }),
    ).toEqual({ ok: false, reason: 'expired' })
  })

  it('allows a backdated use on or before expiry even if today is past expiry', () => {
    const pass = makeCounted({ expiryDate: '2026-09-15' })
    const later = '2026-10-01'
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: '2026-09-15', today: later }).ok).toBe(
      true,
    )
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: later, today: later })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('blocks when no entries are left, including for backdated uses', () => {
    const pass = makeCounted({ totalEntries: 3 })
    const uses = makeUses(pass.id, 3)
    expect(canLogUse({ pass, uses, freezes: [], onDate: today, today })).toEqual({
      ok: false,
      reason: 'no_entries_left',
    })
    expect(canLogUse({ pass, uses, freezes: [], onDate: '2026-09-01', today })).toEqual({
      ok: false,
      reason: 'no_entries_left',
    })
  })

  it('blocks future dates and dates before purchase', () => {
    const pass = makeCounted({ purchaseDate: '2026-06-01' })
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: '2026-10-02', today })).toEqual({
      ok: false,
      reason: 'future_date',
    })
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: '2026-05-31', today })).toEqual({
      ok: false,
      reason: 'before_start',
    })
    expect(canLogUse({ pass, uses: [], freezes: [], onDate: '2026-06-01', today }).ok).toBe(true)
  })

  it('lets an edit move a use when the use being edited is left out of `uses`', () => {
    const pass = makeCounted({ totalEntries: 3 })
    const others = makeUses(pass.id, 2) // the third (being edited) is excluded
    expect(canLogUse({ pass, uses: others, freezes: [], onDate: '2026-09-01', today }).ok).toBe(
      true,
    )
  })
})

describe('canLogUse — memberships', () => {
  const m = makeMembership({ startDate: '2026-09-01', endDate: '2026-09-30' })

  it('blocks visits after the end date', () => {
    expect(
      canLogUse({ pass: m, uses: [], freezes: [], onDate: '2026-09-30', today: '2026-09-30' }).ok,
    ).toBe(true)
    expect(canLogUse({ pass: m, uses: [], freezes: [], onDate: today, today })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('allows visits up to the freeze-extended end date', () => {
    const freezes = [makeFreeze(m.id, '2026-09-10', '2026-09-16')] // → 2026-10-07
    expect(canLogUse({ pass: m, uses: [], freezes, onDate: today, today }).ok).toBe(true)
  })

  it('allows visits during a freeze but flags them as frozen', () => {
    const freezes = [makeFreeze(m.id, '2026-09-10', '2026-09-16')]
    expect(canLogUse({ pass: m, uses: [], freezes, onDate: '2026-09-12', today })).toEqual({
      ok: true,
      frozen: true,
    })
    expect(canLogUse({ pass: m, uses: [], freezes, onDate: '2026-09-17', today })).toEqual({
      ok: true,
      frozen: false,
    })
  })

  it('blocks visits before the start date and in the future', () => {
    expect(canLogUse({ pass: m, uses: [], freezes: [], onDate: '2026-08-31', today })).toEqual({
      ok: false,
      reason: 'before_start',
    })
    expect(canLogUse({ pass: m, uses: [], freezes: [], onDate: '2026-10-02', today })).toEqual({
      ok: false,
      reason: 'future_date',
    })
  })
})

describe('canLogUse — single entries', () => {
  it('is never loggable', () => {
    expect(canLogUse({ pass: makeSingle(), uses: [], freezes: [], onDate: today, today })).toEqual({
      ok: false,
      reason: 'single_entry',
    })
  })
})

describe('useDate', () => {
  it('returns the local date of the timestamp', () => {
    expect(useDate({ usedAt: new Date(2026, 5, 3, 23, 45).toISOString() })).toBe('2026-06-03')
  })
})
