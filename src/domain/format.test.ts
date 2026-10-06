import { DEFAULT_SETTINGS } from './settings'
import { getPassStatus } from './passStatus'
import {
  badgesFor,
  expiryLabel,
  backupNudgeText,
  leftLabel,
  pricePerEntryLabel,
  relativeTime,
  resetLabel,
  reminderMessage,
  refusedDateMessage,
} from './format'
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

describe('relativeTime', () => {
  const today = '2026-10-04'
  const inDays = (days: number) => relativeTime(days, today)

  it('reads naturally on either side of today', () => {
    expect(inDays(0)).toBe('today')
    expect(inDays(1)).toBe('tomorrow')
    expect(inDays(12)).toBe('in 12 days')
    expect(inDays(-1)).toBe('yesterday')
    expect(inDays(-10)).toBe('10 days ago')
  })

  it('counts days up to a month', () => {
    expect(inDays(2)).toBe('in 2 days')
    expect(inDays(26)).toBe('in 26 days') // 30 Oct
    expect(inDays(30)).toBe('in 30 days') // 3 Nov: a day short of a month (4 Nov)
  })

  it('says months and days from a month up to six months', () => {
    expect(inDays(31)).toBe('in 1 month') // 4 Nov
    expect(inDays(32)).toBe('in 1 month 1 day')
    expect(inDays(45)).toBe('in 1 month 14 days') // 18 Nov
    expect(inDays(60)).toBe('in 1 month 29 days') // 3 Dec
    expect(inDays(62)).toBe('in 2 months 1 day') // 5 Dec
  })

  it('says whole months from six months, dropping the days', () => {
    expect(inDays(200)).toBe('in 6 months') // 22 Apr 2027
    expect(inDays(300)).toBe('in 9 months') // 31 Jul 2027
  })

  it('says years and months from a year', () => {
    expect(inDays(365)).toBe('in 1 year')
    expect(inDays(400)).toBe('in 1 year 1 month')
    expect(inDays(730)).toBe('in 1 year 11 months') // 3 Oct 2028: a day short of 2 years
    expect(inDays(731)).toBe('in 2 years')
    expect(inDays(1000)).toBe('in 2 years 8 months')
  })

  it('counts a month from the same day of the next month, and clamps short months', () => {
    expect(relativeTime(28, '2027-01-31')).toBe('in 1 month') // 28 Feb is a month from 31 Jan
    expect(relativeTime(27, '2027-01-31')).toBe('in 27 days') // 27 Feb
    expect(relativeTime(31, '2026-12-31')).toBe('in 1 month') // 31 Jan
    expect(relativeTime(59, '2026-12-31')).toBe('in 2 months') // 28 Feb
    expect(relativeTime(61, '2026-12-31')).toBe('in 2 months 2 days') // 2 Mar
  })

  it('works the same way into the past', () => {
    expect(inDays(-45)).toBe('1 month 14 days ago')
    expect(inDays(-200)).toBe('6 months ago')
    expect(inDays(-400)).toBe('1 year 1 month ago')
  })
})

describe('pricePerEntryLabel', () => {
  it('divides the price by the number of entries, to the cent', () => {
    expect(pricePerEntryLabel(makeCounted({ priceCents: 12000, totalEntries: 10 }))).toBe(
      'S$12.00 each',
    )
    expect(pricePerEntryLabel(makeCounted({ priceCents: 10000, totalEntries: 3 }))).toBe(
      'S$33.33 each',
    )
    expect(pricePerEntryLabel(makeCounted({ priceCents: 10001, totalEntries: 3 }))).toBe(
      'S$33.34 each',
    )
    expect(pricePerEntryLabel(makeCounted({ priceCents: 118000, totalEntries: 20 }))).toBe(
      'S$59.00 each',
    )
  })

  it('uses all the entries bought, however many are used already', () => {
    expect(
      pricePerEntryLabel(makeCounted({ priceCents: 12000, totalEntries: 10, initialUsed: 4 })),
    ).toBe('S$12.00 each')
  })

  it('shows nothing without a price, for a free pass, a single entry or a membership', () => {
    expect(pricePerEntryLabel(makeCounted({ priceCents: null, totalEntries: 10 }))).toBeNull()
    expect(pricePerEntryLabel(makeCounted({ priceCents: 0, totalEntries: 10 }))).toBeNull()
    expect(pricePerEntryLabel(makeSingle({ priceCents: 2500 }))).toBeNull()
    expect(pricePerEntryLabel(makeMembership({ priceCents: 9000 }))).toBeNull()
    expect(pricePerEntryLabel(makeMonthly({ priceCents: 9000 }))).toBeNull()
  })

  it('reads well in thousands', () => {
    expect(pricePerEntryLabel(makeCounted({ priceCents: 300000, totalEntries: 2 }))).toBe(
      'S$1,500.00 each',
    )
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

describe('reminderMessage', () => {
  const base = {
    key: 'p:x',
    passId: 'p',
    today: '2026-10-04',
    daysLeft: null,
    entriesLeft: null,
    window: null,
    resetDate: null,
    daysToReset: null,
  }
  const label = 'Fitbloc, Multipass'

  it('expiring: says when, and how many entries are left', () => {
    const r = { ...base, kind: 'expiring' as const, daysLeft: 3, entriesLeft: 5, window: 3 }
    expect(reminderMessage(r, label)).toBe('Fitbloc, Multipass: expires in 3 days, 5 entries left')
    expect(reminderMessage({ ...r, entriesLeft: 1 }, label)).toBe(
      'Fitbloc, Multipass: expires in 3 days, 1 entry left',
    )
    expect(reminderMessage({ ...r, daysLeft: 0 }, label)).toContain('expires today')
    expect(reminderMessage({ ...r, daysLeft: 1 }, label)).toContain('expires tomorrow')
  })

  it('expiring: a membership has no entries to mention', () => {
    const r = { ...base, kind: 'expiring' as const, daysLeft: 14, window: 14 }
    expect(reminderMessage(r, 'Fitbloc, Membership')).toBe(
      'Fitbloc, Membership: expires in 14 days',
    )
  })

  it('low: says how many are left', () => {
    const r = { ...base, kind: 'low' as const, entriesLeft: 2 }
    expect(reminderMessage(r, label)).toBe('Fitbloc, Multipass: 2 entries left')
    expect(reminderMessage({ ...r, entriesLeft: 1 }, label)).toBe(
      'Fitbloc, Multipass: 1 entry left',
    )
  })

  it('reset: says how many entries will reset and when (FR-59)', () => {
    const r = {
      ...base,
      kind: 'reset' as const,
      entriesLeft: 3,
      daysToReset: 3,
      resetDate: '2026-10-15',
    }
    expect(reminderMessage(r, 'Climb Central, Membership')).toBe(
      'Climb Central, Membership: 3 entries reset in 3 days',
    )
    expect(reminderMessage({ ...r, entriesLeft: 1, daysToReset: 1 }, label)).toBe(
      'Fitbloc, Multipass: 1 entry resets tomorrow',
    )
    expect(reminderMessage({ ...r, daysToReset: 0 }, label)).toContain('reset today')
  })
})

describe('backupNudgeText', () => {
  const today = '2026-10-04'
  it('says how long ago the last backup was', () => {
    expect(backupNudgeText({ daysSince: 45, never: false }, today)).toBe(
      'Your passes are saved only on this phone. Your last backup file was 1 month 14 days ago.',
    )
    expect(backupNudgeText({ daysSince: 200, never: false }, today)).toContain('6 months ago.')
  })
  it('says so when there never was one', () => {
    expect(backupNudgeText({ daysSince: 40, never: true }, today)).toBe(
      'Your passes are saved only on this phone. You have not downloaded a backup file yet.',
    )
  })
})

describe('refusedDateMessage (D58)', () => {
  it('says why in words, with the dates that matter', () => {
    expect(refusedDateMessage({ reason: 'invalid_date' })).toBe('Enter a valid date.')
    expect(refusedDateMessage({ reason: 'in_future' })).toBe('The date cannot be after today.')
    expect(refusedDateMessage({ reason: 'before_purchase', purchaseDate: '2026-10-01' })).toBe(
      'This pass was bought on 1 Oct 2026, so the date cannot be earlier.',
    )
    expect(refusedDateMessage({ reason: 'after_end', lastDate: '2026-12-31' })).toBe(
      'This pass ended on 31 Dec 2026, so the date cannot be later.',
    )
  })

  it('names the month by its first and its last day', () => {
    expect(
      refusedDateMessage({
        reason: 'month_full',
        allowance: 8,
        periodStart: '2026-10-10',
        nextReset: '2026-11-10',
      }),
    ).toBe('All 8 entries are already used in the month of 10 Oct to 9 Nov. Pick another date.')
  })
})
