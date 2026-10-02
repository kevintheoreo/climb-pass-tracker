import { canUseEntry, counterView, hasCounter, planGiveBack } from './counter'
import {
  at,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUse,
  makeUses,
} from './testFactories'

const today = '2026-10-01'

describe('hasCounter', () => {
  it('is true for everything except an unlimited membership', () => {
    expect(hasCounter(makeCounted())).toBe(true)
    expect(hasCounter(makeSingle())).toBe(true)
    expect(hasCounter(makeMonthly())).toBe(true)
    expect(hasCounter(makeMembership())).toBe(false)
  })
})

describe('canUseEntry', () => {
  it('allows a normal use', () => {
    const pass = makeCounted()
    expect(canUseEntry(pass, [], [], today)).toEqual({ ok: true })
  })

  it('allows a use on the expiry date but not the day after (FR-12)', () => {
    const pass = makeCounted({ expiryDate: '2026-10-01' })
    expect(canUseEntry(pass, [], [], '2026-10-01')).toEqual({ ok: true })
    expect(canUseEntry(pass, [], [], '2026-10-02')).toEqual({ ok: false, reason: 'finished' })
  })

  it('blocks when no entries are left (FR-11)', () => {
    const pass = makeCounted({ totalEntries: 3 })
    expect(canUseEntry(pass, makeUses(pass.id, 2), [], today)).toEqual({ ok: true })
    expect(canUseEntry(pass, makeUses(pass.id, 3), [], today)).toEqual({
      ok: false,
      reason: 'none_left',
    })
    const withInitial = makeCounted({ totalEntries: 3, initialUsed: 3 })
    expect(canUseEntry(withInitial, [], [], today)).toEqual({ ok: false, reason: 'none_left' })
  })

  it('a single entry can be used once', () => {
    const pass = makeSingle()
    expect(canUseEntry(pass, [], [], today)).toEqual({ ok: true })
    expect(canUseEntry(pass, makeUses(pass.id, 1), [], today)).toEqual({
      ok: false,
      reason: 'none_left',
    })
  })

  it('an unlimited membership has no counter', () => {
    expect(canUseEntry(makeMembership(), [], [], today)).toEqual({
      ok: false,
      reason: 'no_counter',
    })
  })

  it('a monthly membership is blocked at 0 until the next reset, and stays usable after it', () => {
    const m = makeMonthly()
    const used = makeUses(m.id, 8, '2026-10-12')
    expect(canUseEntry(m, used, [], '2026-10-20')).toEqual({ ok: false, reason: 'none_left' })
    expect(canUseEntry(m, used, [], '2026-11-10')).toEqual({ ok: true })
  })

  it('a monthly membership is blocked once it has ended, counting freezes', () => {
    const m = makeMonthly({ expiryDate: '2026-12-31' })
    expect(canUseEntry(m, [], [], '2027-01-01')).toEqual({ ok: false, reason: 'finished' })
    const frozen = [makeFreeze(m.id, '2026-12-01', '2026-12-10')] // end moves to 2027-01-10
    expect(canUseEntry(m, [], frozen, '2027-01-01')).toEqual({ ok: true })
  })
})

describe('planGiveBack', () => {
  it('removes the most recent recorded use', () => {
    const pass = makeCounted()
    const old = makeUse(pass.id, { usedAt: at('2026-06-01') })
    const recent = makeUse(pass.id, { usedAt: at('2026-06-05') })
    expect(planGiveBack(pass, [old, recent], [], today)).toEqual({
      ok: true,
      action: 'remove_use',
      useId: recent.id,
    })
  })

  it('breaks a timestamp tie by creation time, then id, so the choice is stable', () => {
    const pass = makeCounted()
    const a = makeUse(pass.id, { usedAt: at('2026-06-01'), createdAt: '2026-06-01T10:00:00.000Z' })
    const b = makeUse(pass.id, { usedAt: at('2026-06-01'), createdAt: '2026-06-01T11:00:00.000Z' })
    expect(planGiveBack(pass, [a, b], [], today)).toMatchObject({ useId: b.id })
    expect(planGiveBack(pass, [b, a], [], today)).toMatchObject({ useId: b.id })
  })

  it('ignores deleted uses and uses of other passes', () => {
    const pass = makeCounted()
    const mine = makeUse(pass.id, { usedAt: at('2026-06-01') })
    const deleted = makeUse(pass.id, {
      usedAt: at('2026-06-09'),
      deletedAt: '2026-06-10T00:00:00.000Z',
    })
    const other = makeUse('another', { usedAt: at('2026-06-20') })
    expect(planGiveBack(pass, [mine, deleted, other], [], today)).toMatchObject({ useId: mine.id })
  })

  it('with no recorded uses, lowers "already used"; at full, does nothing (FR-52)', () => {
    expect(planGiveBack(makeCounted({ initialUsed: 2 }), [], [], today)).toEqual({
      ok: true,
      action: 'lower_initial_used',
    })
    expect(planGiveBack(makeCounted({ initialUsed: 0 }), [], [], today)).toEqual({
      ok: false,
      reason: 'full',
    })
  })

  it('a used-up row can give its last entry back to undo a mis-tap', () => {
    const pass = makeCounted({ totalEntries: 1 })
    const uses = makeUses(pass.id, 1)
    expect(planGiveBack(pass, uses, [], today)).toMatchObject({ ok: true, action: 'remove_use' })
  })

  it('an expired row is inert', () => {
    const pass = makeCounted({ expiryDate: '2026-09-30' })
    expect(planGiveBack(pass, makeUses(pass.id, 2), [], today)).toEqual({
      ok: false,
      reason: 'finished',
    })
  })

  it('an unlimited membership has nothing to give back', () => {
    expect(planGiveBack(makeMembership(), [], [], today)).toEqual({
      ok: false,
      reason: 'no_counter',
    })
  })

  it('a monthly membership only gives back uses from the current period', () => {
    const m = makeMonthly()
    const lastMonth = makeUse(m.id, { usedAt: at('2026-10-12') })
    const thisMonth = makeUse(m.id, { usedAt: at('2026-11-12') })
    expect(planGiveBack(m, [lastMonth], [], '2026-11-15')).toEqual({ ok: false, reason: 'full' })
    expect(planGiveBack(m, [lastMonth, thisMonth], [], '2026-11-15')).toMatchObject({
      useId: thisMonth.id,
    })
  })
})

describe('counterView', () => {
  it('a fresh pass can only be used; a part-used one can be used or given back', () => {
    const pass = makeCounted({ totalEntries: 10 })
    expect(counterView(pass, [], [], today)).toEqual({
      visible: true,
      canUse: true,
      canGiveBack: false,
    })
    expect(counterView(pass, makeUses(pass.id, 3), [], today)).toEqual({
      visible: true,
      canUse: true,
      canGiveBack: true,
    })
  })

  it('a used-up row can only give an entry back (to undo a mis-tap)', () => {
    const pass = makeCounted({ totalEntries: 2 })
    expect(counterView(pass, makeUses(pass.id, 2), [], today)).toEqual({
      visible: true,
      canUse: false,
      canGiveBack: true,
    })
  })

  it('a monthly membership at 0 can only give back, until the reset', () => {
    const m = makeMonthly()
    const used = makeUses(m.id, 8, '2026-10-12')
    expect(counterView(m, used, [], '2026-10-20')).toEqual({
      visible: true,
      canUse: false,
      canGiveBack: true,
    })
    expect(counterView(m, used, [], '2026-11-10')).toEqual({
      visible: true,
      canUse: true,
      canGiveBack: false,
    })
  })

  it('an expired row and an unlimited membership have no buttons', () => {
    const expired = makeCounted({ expiryDate: '2026-09-30' })
    expect(counterView(expired, makeUses(expired.id, 2), [], today)).toEqual({
      visible: false,
      canUse: false,
      canGiveBack: false,
    })
    expect(counterView(makeMembership(), [], [], today)).toEqual({
      visible: false,
      canUse: false,
      canGiveBack: false,
    })
  })
})
