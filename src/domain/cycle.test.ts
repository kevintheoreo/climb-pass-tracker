import {
  currentPeriod,
  daysInMonth,
  daysUntilReset,
  monthlyEntriesLeft,
  resetDateIn,
  resetDayOf,
  usesInPeriod,
} from './cycle'
import { at, makeMonthly, makeUse } from './testFactories'

describe('resetDateIn', () => {
  it('uses the reset day, clamped to the last day of a shorter month', () => {
    expect(resetDateIn(2026, 10, 15)).toBe('2026-10-15')
    expect(resetDateIn(2026, 4, 31)).toBe('2026-04-30')
    expect(resetDateIn(2026, 2, 31)).toBe('2026-02-28')
    expect(resetDateIn(2028, 2, 31)).toBe('2028-02-29')
    expect(resetDateIn(2026, 12, 31)).toBe('2026-12-31')
  })

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})

describe('resetDayOf', () => {
  it('defaults to the day of the purchase date, and can be set (D33)', () => {
    expect(resetDayOf(makeMonthly({ purchaseDate: '2026-10-17' }))).toBe(17)
    expect(resetDayOf(makeMonthly({ purchaseDate: '2026-10-17', resetDay: 3 }))).toBe(3)
  })
})

describe('currentPeriod', () => {
  const pass = makeMonthly() // bought 2026-10-10, resets on the 10th

  it('starts on the purchase date for the first period', () => {
    expect(currentPeriod(pass, '2026-10-10')).toEqual({
      start: '2026-10-10',
      nextReset: '2026-11-10',
    })
    expect(currentPeriod(pass, '2026-11-09')).toEqual({
      start: '2026-10-10',
      nextReset: '2026-11-10',
    })
  })

  it('starts a new period on the reset day itself', () => {
    expect(currentPeriod(pass, '2026-11-10')).toEqual({
      start: '2026-11-10',
      nextReset: '2026-12-10',
    })
    expect(currentPeriod(pass, '2026-12-09')).toEqual({
      start: '2026-11-10',
      nextReset: '2026-12-10',
    })
  })

  it('crosses the end of the year', () => {
    expect(currentPeriod(pass, '2026-12-10')).toEqual({
      start: '2026-12-10',
      nextReset: '2027-01-10',
    })
    expect(currentPeriod(pass, '2027-01-09')).toEqual({
      start: '2026-12-10',
      nextReset: '2027-01-10',
    })
    expect(currentPeriod(pass, '2027-01-10')).toEqual({
      start: '2027-01-10',
      nextReset: '2027-02-10',
    })
  })

  it('gives a short first period the full allowance when the reset day is changed (D33)', () => {
    const moved = makeMonthly({ resetDay: 20 })
    expect(currentPeriod(moved, '2026-10-12')).toEqual({
      start: '2026-10-10',
      nextReset: '2026-10-20',
    })
    expect(currentPeriod(moved, '2026-10-20')).toEqual({
      start: '2026-10-20',
      nextReset: '2026-11-20',
    })
  })

  it('moves a reset day the month does not have to the last day', () => {
    const late = makeMonthly({ purchaseDate: '2026-01-31' }) // resets on the 31st
    expect(currentPeriod(late, '2026-03-05')).toEqual({
      start: '2026-02-28',
      nextReset: '2026-03-31',
    })
    expect(currentPeriod(late, '2026-03-31')).toEqual({
      start: '2026-03-31',
      nextReset: '2026-04-30',
    })
    expect(currentPeriod(late, '2026-04-30')).toEqual({
      start: '2026-04-30',
      nextReset: '2026-05-31',
    })
  })

  it('treats a date before the purchase date as the first period', () => {
    expect(currentPeriod(pass, '2026-09-01')).toEqual({
      start: '2026-10-10',
      nextReset: '2026-11-10',
    })
  })

  it('counts the days until the next reset', () => {
    expect(daysUntilReset(pass, '2026-11-07')).toBe(3)
    expect(daysUntilReset(pass, '2026-11-09')).toBe(1)
    expect(daysUntilReset(pass, '2026-11-10')).toBe(30) // 10 Nov to 10 Dec
  })
})

describe('monthlyEntriesLeft', () => {
  const pass = makeMonthly() // 8 a month, resets on the 10th
  const use = (date: string, overrides = {}) => makeUse(pass.id, { usedAt: at(date), ...overrides })

  it('counts only uses in the current period', () => {
    const uses = [use('2026-10-12'), use('2026-10-30'), use('2026-11-11')]
    expect(monthlyEntriesLeft(pass, uses, '2026-10-31')).toBe(6) // two used this period
    expect(monthlyEntriesLeft(pass, uses, '2026-11-12')).toBe(7) // reset: only the 11th counts
  })

  it('returns to the full allowance at the reset (D32)', () => {
    const uses = Array.from({ length: 8 }, () => use('2026-10-15'))
    expect(monthlyEntriesLeft(pass, uses, '2026-11-09')).toBe(0)
    expect(monthlyEntriesLeft(pass, uses, '2026-11-10')).toBe(8)
  })

  it('counts a use on the first day of a period, but not on the next reset day', () => {
    const period = currentPeriod(pass, '2026-11-15')
    expect(usesInPeriod(pass, [use('2026-11-10')], period)).toHaveLength(1)
    expect(usesInPeriod(pass, [use('2026-12-10')], period)).toHaveLength(0)
    expect(usesInPeriod(pass, [use('2026-11-09')], period)).toHaveLength(0)
  })

  it('ignores deleted uses and other passes, and never goes below 0', () => {
    const uses = [
      use('2026-10-12'),
      use('2026-10-12', { deletedAt: '2026-10-13T00:00:00.000Z' }),
      makeUse('another-pass', { usedAt: at('2026-10-12') }),
    ]
    expect(monthlyEntriesLeft(pass, uses, '2026-10-20')).toBe(7)
    const many = Array.from({ length: 12 }, () => use('2026-10-12'))
    expect(monthlyEntriesLeft(pass, many, '2026-10-20')).toBe(0)
  })

  it('recalculates straight away when the reset day or allowance changes', () => {
    const uses = [use('2026-10-12'), use('2026-10-25')]
    expect(monthlyEntriesLeft(pass, uses, '2026-10-26')).toBe(6)
    // Reset moved to the 20th: the 12th is now in the earlier period.
    expect(monthlyEntriesLeft({ ...pass, resetDay: 20 }, uses, '2026-10-26')).toBe(7)
    expect(monthlyEntriesLeft({ ...pass, monthlyEntries: 4 }, uses, '2026-10-26')).toBe(2)
  })
})
