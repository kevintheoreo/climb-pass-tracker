import { DEFAULT_SETTINGS } from './settings'
import { daysLeft, effectiveEndDate, entriesLeft, getPassStatus, isFrozenOn } from './passStatus'
import {
  makeCounted,
  makeFreeze,
  makeMembership,
  makeSingle,
  makeUse,
  makeUses,
} from './testFactories'

const settings = DEFAULT_SETTINGS

describe('entriesLeft', () => {
  it('is total minus already-used minus logged uses', () => {
    const pass = makeCounted({ totalEntries: 10, initialUsed: 2 })
    expect(entriesLeft(pass, makeUses(pass.id, 3))).toBe(5)
  })

  it('ignores soft-deleted uses and uses of other passes', () => {
    const pass = makeCounted({ totalEntries: 5 })
    const uses = [
      makeUse(pass.id),
      makeUse(pass.id, { deletedAt: '2026-06-02T00:00:00.000Z' }),
      makeUse('some-other-pass'),
    ]
    expect(entriesLeft(pass, uses)).toBe(4)
  })

  it('never goes below zero', () => {
    const pass = makeCounted({ totalEntries: 2 })
    expect(entriesLeft(pass, makeUses(pass.id, 5))).toBe(0)
  })
})

describe('effectiveEndDate', () => {
  const m = makeMembership({ startDate: '2026-10-01', endDate: '2026-10-31' })

  it('is the base end date with no freezes', () => {
    expect(effectiveEndDate(m, [])).toBe('2026-10-31')
  })

  it('adds the inclusive length of a freeze', () => {
    expect(effectiveEndDate(m, [makeFreeze(m.id, '2026-10-10', '2026-10-16')])).toBe('2026-11-07')
    expect(effectiveEndDate(m, [makeFreeze(m.id, '2026-10-10', '2026-10-10')])).toBe('2026-11-01')
  })

  it('adds several separate freezes', () => {
    const freezes = [
      makeFreeze(m.id, '2026-10-05', '2026-10-06'),
      makeFreeze(m.id, '2026-10-20', '2026-10-22'),
    ]
    expect(effectiveEndDate(m, freezes)).toBe('2026-11-05') // +2 +3 days
  })

  it('does not double count overlapping or touching freezes', () => {
    const overlapping = [
      makeFreeze(m.id, '2026-10-10', '2026-10-14'),
      makeFreeze(m.id, '2026-10-12', '2026-10-18'),
    ]
    expect(effectiveEndDate(m, overlapping)).toBe('2026-11-09') // 10-18 Oct = 9 distinct days
    const touching = [
      makeFreeze(m.id, '2026-10-10', '2026-10-14'),
      makeFreeze(m.id, '2026-10-15', '2026-10-16'),
    ]
    expect(effectiveEndDate(m, touching)).toBe('2026-11-07') // 10-16 Oct = 7 days
  })

  it('counts a freeze that runs past the base end date', () => {
    expect(effectiveEndDate(m, [makeFreeze(m.id, '2026-10-30', '2026-11-05')])).toBe('2026-11-07') // 7 days
  })

  it('counts a later freeze once an earlier one has pushed the end date out to it', () => {
    const freezes = [
      makeFreeze(m.id, '2026-10-20', '2026-10-31'), // +12 → ends 11-12
      makeFreeze(m.id, '2026-11-05', '2026-11-06'), // now inside the membership → +2
    ]
    expect(effectiveEndDate(m, freezes)).toBe('2026-11-14')
  })

  it('ignores a freeze that starts after the membership has ended', () => {
    expect(effectiveEndDate(m, [makeFreeze(m.id, '2026-12-01', '2026-12-10')])).toBe('2026-10-31')
  })

  it('ignores freezes that ended before the start, deleted freezes and other passes', () => {
    const freezes = [
      makeFreeze(m.id, '2026-09-01', '2026-09-05'),
      makeFreeze(m.id, '2026-10-10', '2026-10-12'),
      makeFreeze('other-pass', '2026-10-10', '2026-10-12'),
    ]
    freezes[1]!.deletedAt = '2026-10-11T00:00:00.000Z'
    expect(effectiveEndDate(m, freezes)).toBe('2026-10-31')
  })
})

describe('isFrozenOn', () => {
  it('includes both the first and last day of a freeze', () => {
    const m = makeMembership()
    const freezes = [makeFreeze(m.id, '2026-10-10', '2026-10-12')]
    expect(isFrozenOn('2026-10-09', m, freezes)).toBe(false)
    expect(isFrozenOn('2026-10-10', m, freezes)).toBe(true)
    expect(isFrozenOn('2026-10-12', m, freezes)).toBe(true)
    expect(isFrozenOn('2026-10-13', m, freezes)).toBe(false)
  })
})

describe('daysLeft', () => {
  it('is 0 on the expiry date and negative after it', () => {
    const pass = makeCounted({ expiryDate: '2026-10-10' })
    expect(daysLeft(pass, [], '2026-10-09')).toBe(1)
    expect(daysLeft(pass, [], '2026-10-10')).toBe(0)
    expect(daysLeft(pass, [], '2026-10-11')).toBe(-1)
  })

  it('uses the freeze-extended end for memberships and is null for single entries', () => {
    const m = makeMembership({ endDate: '2026-10-31' })
    expect(daysLeft(m, [makeFreeze(m.id, '2026-10-10', '2026-10-16')], '2026-10-31')).toBe(7)
    expect(daysLeft(makeSingle(), [], '2026-10-31')).toBeNull()
  })
})

describe('getPassStatus — counted passes', () => {
  const today = '2026-10-01'

  it('is active with no flags when plenty is left and expiry is far off', () => {
    const pass = makeCounted({ expiryDate: '2027-04-01' })
    const s = getPassStatus(pass, makeUses(pass.id, 3), [], today, settings)
    expect(s).toMatchObject({
      state: 'active',
      isActive: true,
      entriesLeft: 7,
      expiringSoon: false,
      low: false,
    })
  })

  it('flags expiring soon from 14 days out, including exactly 14 and the expiry day', () => {
    const at = (expiryDate: string) =>
      getPassStatus(makeCounted({ expiryDate }), [], [], today, settings)
    expect(at('2026-10-16').expiringSoon).toBe(false) // 15 days
    expect(at('2026-10-15').expiringSoon).toBe(true) // 14 days
    expect(at('2026-10-01')).toMatchObject({ state: 'active', expiringSoon: true, daysLeft: 0 })
  })

  it('flags low at the threshold and below, but not above', () => {
    const pass = makeCounted({ totalEntries: 10 })
    expect(getPassStatus(pass, makeUses(pass.id, 7), [], today, settings).low).toBe(false) // 3 left
    expect(getPassStatus(pass, makeUses(pass.id, 8), [], today, settings).low).toBe(true) // 2 left
    expect(getPassStatus(pass, makeUses(pass.id, 9), [], today, settings).low).toBe(true) // 1 left
  })

  it('is used up at zero entries, even if also past expiry', () => {
    const pass = makeCounted({ totalEntries: 2, expiryDate: '2026-09-01' })
    const s = getPassStatus(pass, makeUses(pass.id, 2), [], today, settings)
    expect(s).toMatchObject({
      state: 'used_up',
      isActive: false,
      entriesLeft: 0,
      unused: 0,
      low: false,
    })
  })

  it('is expired with the unused entries counted, only after the expiry date', () => {
    const pass = makeCounted({ totalEntries: 10, expiryDate: '2026-09-30' })
    const s = getPassStatus(pass, makeUses(pass.id, 4), [], today, settings)
    expect(s).toMatchObject({
      state: 'expired',
      isActive: false,
      entriesLeft: 6,
      unused: 6,
      expiringSoon: false,
      low: false,
    })
  })

  it('is still active on the expiry date itself', () => {
    const pass = makeCounted({ expiryDate: today })
    expect(getPassStatus(pass, [], [], today, settings).state).toBe('active')
  })

  it('counts initialUsed as already used', () => {
    const pass = makeCounted({ totalEntries: 10, initialUsed: 10 })
    expect(getPassStatus(pass, [], [], today, settings).state).toBe('used_up')
  })

  it('treats class packs like multipasses', () => {
    const pass = makeCounted({ passType: 'class_pack', totalEntries: 4 })
    expect(getPassStatus(pass, makeUses(pass.id, 3), [], today, settings)).toMatchObject({
      state: 'active',
      entriesLeft: 1,
      low: true,
    })
  })

  it('uses the configured thresholds', () => {
    const pass = makeCounted({ expiryDate: '2026-10-31', totalEntries: 10 })
    const custom = { expiryReminderDays: [30], lowEntriesThreshold: 5 }
    const s = getPassStatus(pass, makeUses(pass.id, 5), [], today, custom)
    expect(s).toMatchObject({ expiringSoon: true, low: true })
  })
})

describe('getPassStatus — memberships and single entries', () => {
  it('is active, and expiring soon within the window', () => {
    const m = makeMembership({ endDate: '2026-10-31' })
    expect(getPassStatus(m, [], [], '2026-10-01', settings)).toMatchObject({
      state: 'active',
      isActive: true,
      expiringSoon: false,
      daysLeft: 30,
    })
    expect(getPassStatus(m, [], [], '2026-10-17', settings)).toMatchObject({
      expiringSoon: true,
      daysLeft: 14,
    })
  })

  it('is expired the day after the (freeze-extended) end date', () => {
    const m = makeMembership({ endDate: '2026-10-31' })
    const freezes = [makeFreeze(m.id, '2026-10-10', '2026-10-16')] // ends 2026-11-07
    expect(getPassStatus(m, [], freezes, '2026-11-07', settings).state).toBe('active')
    expect(getPassStatus(m, [], freezes, '2026-11-08', settings)).toMatchObject({
      state: 'expired',
      isActive: false,
    })
    expect(getPassStatus(m, [], [], '2026-11-01', settings).state).toBe('expired')
  })

  it('is frozen during a freeze, stays on the dashboard, and shows no expiry badge', () => {
    const m = makeMembership({ endDate: '2026-10-31' })
    const freezes = [makeFreeze(m.id, '2026-10-20', '2026-10-30')]
    const s = getPassStatus(m, [], freezes, '2026-10-25', settings)
    expect(s).toMatchObject({ state: 'frozen', isActive: true, expiringSoon: false })
    expect(getPassStatus(m, [], freezes, '2026-10-31', settings).state).toBe('active')
  })

  it('puts single entries straight into history', () => {
    expect(getPassStatus(makeSingle(), [], [], '2026-10-01', settings)).toMatchObject({
      state: 'visit',
      isActive: false,
      daysLeft: null,
      entriesLeft: null,
    })
  })
})
