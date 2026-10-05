import {
  at,
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUse,
} from './testFactories'
import { buildHistory, checkUseDate } from './history'
import type { GymRef, Pass } from './types'

const gymName = (ref: GymRef) => (ref.id === 'gym-b' ? 'Boulder Planet' : 'Fit Bloc')
const TODAY = '2026-10-20'

describe('buildHistory (D58)', () => {
  it('lists every use of every pass, newest first, with the gym, type and date', () => {
    const a = makeCounted({ gymRef: { kind: 'builtin', id: 'gym-a' } })
    const b = makeSingle({ gymRef: { kind: 'builtin', id: 'gym-b' } })
    const u1 = makeUse(a.id, { usedAt: at('2026-10-02') })
    const u2 = makeUse(b.id, { usedAt: at('2026-10-09') })
    const u3 = makeUse(a.id, { usedAt: at('2026-10-05') })
    const list = buildHistory([bundle(a, { uses: [u1, u3] }), bundle(b, { uses: [u2] })], gymName)
    expect(list.map((e) => [e.date, e.gymName, e.typeLabel])).toEqual([
      ['2026-10-09', 'Boulder Planet', 'Single entry'],
      ['2026-10-05', 'Fit Bloc', 'Multipass'],
      ['2026-10-02', 'Fit Bloc', 'Multipass'],
    ])
    expect(list[0]!.use).toBe(u2)
    expect(list[0]!.pass).toBe(b)
  })

  it('puts uses on the same day in the order they happened, then the order they were recorded', () => {
    const p = makeCounted()
    const morning = makeUse(p.id, { usedAt: at('2026-10-05', 9) })
    const evening = makeUse(p.id, { usedAt: at('2026-10-05', 19) })
    const list = buildHistory([bundle(p, { uses: [morning, evening] })], gymName)
    expect(list.map((e) => e.use)).toEqual([evening, morning])
  })

  it('leaves out uses that were taken back, and the uses of a deleted pass', () => {
    const p = makeCounted()
    const kept = makeUse(p.id, { usedAt: at('2026-10-05') })
    const undone = makeUse(p.id, { deletedAt: '2026-10-06T00:00:00.000Z' })
    const gone = makeCounted({ deletedAt: '2026-10-06T00:00:00.000Z' })
    const goneUse = makeUse(gone.id)
    const list = buildHistory(
      [bundle(p, { uses: [kept, undone] }), bundle(gone, { uses: [goneUse] })],
      gymName,
    )
    expect(list.map((e) => e.use)).toEqual([kept])
  })

  it('is empty when nothing has been used', () => {
    expect(buildHistory([bundle(makeCounted())], gymName)).toEqual([])
    expect(buildHistory([], gymName)).toEqual([])
  })
})

describe('checkUseDate (D58)', () => {
  const pass = makeCounted({ purchaseDate: '2026-10-01', expiryDate: '2026-12-31' })
  const use = makeUse(pass.id, { usedAt: at('2026-10-10') })
  const check = (date: string, p: Pass = pass, freezes = [] as ReturnType<typeof makeFreeze>[]) =>
    checkUseDate(p, use, [use], freezes, date, TODAY)

  it('accepts a date from the purchase date to today', () => {
    expect(check('2026-10-01')).toEqual({ ok: true })
    expect(check('2026-10-15')).toEqual({ ok: true })
    expect(check(TODAY)).toEqual({ ok: true })
  })

  it('refuses anything that is not a real date', () => {
    for (const bad of ['', 'yesterday', '2026-13-01', '2026-02-30', '10/10/2026', '2026-1-5']) {
      expect(check(bad)).toMatchObject({ ok: false, reason: 'invalid_date' })
    }
  })

  it('refuses a date before the pass was bought', () => {
    expect(check('2026-09-30')).toEqual({
      ok: false,
      reason: 'before_purchase',
      purchaseDate: '2026-10-01',
    })
  })

  it('refuses a date in the future', () => {
    expect(check('2026-10-21')).toEqual({ ok: false, reason: 'in_future' })
  })

  it('refuses a date after the last day the pass is valid', () => {
    const short = makeCounted({ purchaseDate: '2026-10-01', expiryDate: '2026-10-12' })
    expect(check('2026-10-12', short)).toEqual({ ok: true }) // usable through its expiry date
    expect(check('2026-10-13', short)).toEqual({
      ok: false,
      reason: 'after_end',
      lastDate: '2026-10-12',
    })
  })

  it("counts a membership's freezes as part of its validity", () => {
    const m = makeMembership({ purchaseDate: '2026-10-01', expiryDate: '2026-10-12' })
    const freezes = [makeFreeze(m.id, '2026-10-05', '2026-10-09')] // 5 days: ends 17 Oct
    expect(check('2026-10-17', m, freezes)).toEqual({ ok: true })
    expect(check('2026-10-18', m, freezes)).toMatchObject({ ok: false, reason: 'after_end' })
  })

  it('has no end for a single entry without an expiry', () => {
    const s = makeSingle({ purchaseDate: '2026-10-01', expiryDate: null })
    expect(check(TODAY, s)).toEqual({ ok: true })
  })
})

describe('checkUseDate for a monthly membership (D58)', () => {
  // 3 entries a month, bought 10 Oct 2026, resetting on the 10th: periods 10 Oct–9 Nov, 10 Nov–…
  const pass = makeMonthly({
    monthlyEntries: 3,
    purchaseDate: '2026-10-10',
    expiryDate: '2027-10-09',
  })
  const today = '2026-12-20'
  const inOctober = [
    makeUse(pass.id, { usedAt: at('2026-10-11') }),
    makeUse(pass.id, { usedAt: at('2026-10-12') }),
    makeUse(pass.id, { usedAt: at('2026-10-13') }),
  ]
  const november = makeUse(pass.id, { usedAt: at('2026-11-12') })
  const uses = [...inOctober, november]
  const check = (u: (typeof uses)[number], date: string) =>
    checkUseDate(pass, u, uses, [], date, today)

  it('refuses to move a use into a month that is already full', () => {
    expect(check(november, '2026-10-20')).toEqual({
      ok: false,
      reason: 'month_full',
      allowance: 3,
      periodStart: '2026-10-10',
      nextReset: '2026-11-10',
    })
  })

  it('allows a move within the same month, even when that month is full', () => {
    expect(check(inOctober[0]!, '2026-10-30')).toEqual({ ok: true })
  })

  it('allows a move into a month with room', () => {
    expect(check(inOctober[0]!, '2026-11-20')).toEqual({ ok: true })
    expect(check(november, '2026-12-01')).toEqual({ ok: true })
  })

  it('counts the month by its reset day, not by the calendar month', () => {
    // 9 Nov is still the October period (it runs to 9 Nov); 10 Nov starts the next one.
    expect(check(november, '2026-11-09')).toMatchObject({ ok: false, reason: 'month_full' })
    expect(check(inOctober[0]!, '2026-11-10')).toEqual({ ok: true })
  })
})
