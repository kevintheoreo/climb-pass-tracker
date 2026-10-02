import { DEFAULT_SETTINGS } from './settings'
import { getPassStatus } from './passStatus'
import { badgesFor, expiryLabel, leftLabel, relativeDays, resetLabel } from './format'
import { formatDate, formatDayMonth } from './dates'
import {
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUses,
} from './testFactories'

const today = '2026-10-20'
const status = (
  pass: Parameters<typeof getPassStatus>[0],
  uses = [] as ReturnType<typeof makeUses>,
  freezes = [] as ReturnType<typeof makeFreeze>[],
) => getPassStatus(pass, uses, freezes, today, DEFAULT_SETTINGS)

describe('dates', () => {
  it('formats a date for display', () => {
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
    expect(formatDate('2027-01-05')).toBe('5 Jan 2027')
    expect(formatDayMonth('2026-11-15')).toBe('15 Nov')
  })
})

describe('relativeDays', () => {
  it('reads naturally on either side of today', () => {
    expect(relativeDays(0)).toBe('today')
    expect(relativeDays(1)).toBe('tomorrow')
    expect(relativeDays(12)).toBe('in 12 days')
    expect(relativeDays(-1)).toBe('yesterday')
    expect(relativeDays(-10)).toBe('10 days ago')
  })
})

describe('expiryLabel', () => {
  it('shows the date, or "No expiry"', () => {
    expect(expiryLabel('2026-12-31')).toBe('31 Dec 2026')
    expect(expiryLabel(null)).toBe('No expiry')
  })
})

describe('leftLabel / resetLabel', () => {
  it('counted passes show entries left out of the total', () => {
    const pass = makeCounted({ totalEntries: 10 })
    expect(leftLabel(status(pass, makeUses(pass.id, 3)))).toBe('7 / 10')
    expect(resetLabel(status(pass))).toBeNull()
  })

  it('a single entry shows 1 / 1, then 0 / 1', () => {
    const pass = makeSingle()
    expect(leftLabel(status(pass))).toBe('1 / 1')
    expect(leftLabel(status(pass, makeUses(pass.id, 1)))).toBe('0 / 1')
  })

  it('an unlimited membership says "Unlimited"', () => {
    const s = status(makeMembership({ expiryDate: '2027-01-01' }))
    expect(leftLabel(s)).toBe('Unlimited')
    expect(resetLabel(s)).toBeNull()
  })

  it('a monthly membership shows this month’s count and when it resets', () => {
    const m = makeMonthly({ purchaseDate: '2026-10-10' })
    const s = status(m, makeUses(m.id, 5, '2026-10-12'))
    expect(leftLabel(s)).toBe('3 / 8')
    expect(resetLabel(s)).toBe('resets 10 Nov')
  })
})

describe('badgesFor', () => {
  const labels = (pass: Parameters<typeof badgesFor>[0], s: Parameters<typeof badgesFor>[1]) =>
    badgesFor(pass, s).map((b) => b.label)

  it('has none for a pass with nothing to flag', () => {
    const pass = makeCounted({ expiryDate: '2027-06-01' })
    expect(labels(pass, status(pass))).toEqual([])
  })

  it('flags expiring soon and low, both when both apply', () => {
    const pass = makeCounted({ totalEntries: 10, expiryDate: '2026-10-25' })
    expect(labels(pass, status(pass, makeUses(pass.id, 9)))).toEqual(['Expiring soon', 'Low'])
    const lowOnly = makeCounted({ totalEntries: 10, expiryDate: '2027-06-01' })
    expect(labels(lowOnly, status(lowOnly, makeUses(lowOnly.id, 8)))).toEqual(['Low'])
  })

  it('flags a frozen membership', () => {
    const m = makeMembership({ purchaseDate: '2026-10-01', expiryDate: '2026-12-31' })
    const s = status(m, [], [makeFreeze(m.id, '2026-10-15', '2026-10-25')])
    expect(labels(m, s)).toEqual(['Frozen'])
  })

  it('a single entry, a monthly membership and an unlimited membership are never "Low"', () => {
    expect(labels(makeSingle(), status(makeSingle()))).toEqual([])
    const m = makeMonthly({ expiryDate: '2027-10-09' })
    expect(labels(m, status(m, makeUses(m.id, 7, '2026-10-12')))).toEqual([])
  })

  it('Finished rows say "Used up" or how many entries went unused', () => {
    const usedUp = makeCounted({ totalEntries: 2 })
    expect(labels(usedUp, status(usedUp, makeUses(usedUp.id, 2)))).toEqual(['Used up'])
    const expired = makeCounted({ totalEntries: 10, expiryDate: '2026-10-01' })
    expect(labels(expired, status(expired, makeUses(expired.id, 4)))).toEqual([
      'Expired – 6 unused',
    ])
    const single = makeSingle({ expiryDate: '2026-10-01' })
    expect(labels(single, status(single))).toEqual(['Expired – 1 unused'])
  })

  it('an expired membership just says "Expired"', () => {
    const m = makeMembership({ expiryDate: '2026-10-01' })
    expect(labels(m, status(m))).toEqual(['Expired'])
  })
})
