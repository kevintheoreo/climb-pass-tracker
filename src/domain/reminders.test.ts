import { DEFAULT_SETTINGS, type Settings } from './settings'
import { dismissalValue, getReminders, groupByPass, reminderKey } from './reminders'
import {
  at,
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUse,
  makeUses,
} from './testFactories'

const today = '2026-10-01'
const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
})
const summary = (rs: ReturnType<typeof getReminders>) => rs.map((r) => `${r.passId}:${r.kind}`)

describe('getReminders — expiring', () => {
  it('appears inside the widest window (14 days) and not before', () => {
    const at15 = bundle(makeCounted({ id: 'p', expiryDate: '2026-10-16' }))
    const at14 = bundle(makeCounted({ id: 'p', expiryDate: '2026-10-15' }))
    expect(getReminders([at15], settings(), today)).toEqual([])
    expect(getReminders([at14], settings(), today)).toEqual([
      expect.objectContaining({ kind: 'expiring', passId: 'p', daysLeft: 14, window: 14 }),
    ])
  })

  it('reports the tightest window reached', () => {
    const b = (expiryDate: string) => bundle(makeCounted({ id: 'p', expiryDate }))
    expect(getReminders([b('2026-10-04')], settings(), today)[0]?.window).toBe(3)
    expect(getReminders([b('2026-10-05')], settings(), today)[0]?.window).toBe(14)
    expect(getReminders([b('2026-10-01')], settings(), today)[0]?.window).toBe(3)
  })

  it('also covers memberships, but not a single entry with no expiry', () => {
    const m = bundle(makeMembership({ id: 'm', expiryDate: '2026-10-10' }))
    expect(summary(getReminders([m], settings(), today))).toEqual(['m:expiring'])
    expect(getReminders([bundle(makeSingle({ id: 's' }))], settings(), today)).toEqual([])
  })

  it('stays quiet for passes that are not active', () => {
    const usedUp = bundle(makeCounted({ id: 'a', totalEntries: 1, expiryDate: '2026-10-05' }), {
      uses: makeUses('a', 1),
    })
    const expired = bundle(makeCounted({ id: 'b', expiryDate: '2026-09-30' }))
    const frozen = bundle(makeMembership({ id: 'd', expiryDate: '2026-10-10' }), {
      freezes: [makeFreeze('d', today, '2026-10-02')],
    })
    const deleted = bundle(
      makeCounted({ id: 'e', expiryDate: '2026-10-05', deletedAt: '2026-09-01T00:00:00.000Z' }),
    )
    expect(getReminders([usedUp, expired, frozen, deleted], settings(), today)).toEqual([])
  })

  it('respects the on/off switch and custom windows', () => {
    const b = bundle(makeCounted({ id: 'p', expiryDate: '2026-10-20' }))
    expect(getReminders([b], settings({ expiryRemindersEnabled: false }), today)).toEqual([])
    expect(getReminders([b], settings({ expiryReminderDays: [30, 7] }), today)[0]?.window).toBe(30)
    expect(getReminders([b], settings({ expiryReminderDays: [] }), today)).toEqual([])
  })
})

describe('getReminders — low entries', () => {
  it('appears at 2 entries left or fewer, not at 3 or 0', () => {
    const left = (n: number) => {
      const pass = makeCounted({ id: 'p', totalEntries: 10 })
      return getReminders([bundle(pass, { uses: makeUses('p', 10 - n) })], settings(), today)
    }
    expect(left(3)).toEqual([])
    expect(left(2)).toEqual([expect.objectContaining({ kind: 'low', entriesLeft: 2 })])
    expect(left(1)).toEqual([expect.objectContaining({ kind: 'low', entriesLeft: 1 })])
    expect(left(0)).toEqual([])
  })

  it('never applies to memberships or single entries, and respects the switch and threshold', () => {
    expect(getReminders([bundle(makeMembership({ id: 'm' }))], settings(), today)).toEqual([])
    expect(getReminders([bundle(makeSingle({ id: 's' }))], settings(), today)).toEqual([])
    const monthly = makeMonthly({ id: 'mm' })
    expect(
      getReminders(
        [bundle(monthly, { uses: makeUses('mm', 7, '2026-10-12') })],
        settings(),
        '2026-10-20',
      ),
    ).toEqual([])
    const pass = makeCounted({ id: 'p', totalEntries: 10 })
    const b = bundle(pass, { uses: makeUses('p', 6) }) // 4 left
    expect(
      getReminders([b], settings({ lowRemindersEnabled: false, lowEntriesThreshold: 5 }), today),
    ).toEqual([])
    expect(summary(getReminders([b], settings({ lowEntriesThreshold: 5 }), today))).toEqual([
      'p:low',
    ])
  })

  it('can raise both banners for one pass', () => {
    const pass = makeCounted({ id: 'p', totalEntries: 4, expiryDate: '2026-10-10' })
    const b = bundle(pass, { uses: makeUses('p', 2) })
    expect(summary(getReminders([b], settings(), today))).toEqual(['p:expiring', 'p:low'])
  })
})

describe('getReminders — monthly reset (D34, FR-59)', () => {
  const m = makeMonthly({ id: 'm' }) // 8 a month, resets on the 10th, ends 2027-10-09
  const withUses = (n: number, date = '2026-10-12') => bundle(m, { uses: makeUses('m', n, date) })

  it('appears 3 days before the reset when entries are left', () => {
    expect(getReminders([withUses(3)], settings(), '2026-11-06')).toEqual([]) // 4 days
    expect(getReminders([withUses(3)], settings(), '2026-11-07')).toEqual([
      expect.objectContaining({
        kind: 'reset',
        passId: 'm',
        entriesLeft: 5,
        resetDate: '2026-11-10',
        daysToReset: 3,
      }),
    ])
    expect(summary(getReminders([withUses(3)], settings(), '2026-11-09'))).toEqual(['m:reset'])
  })

  it('stays quiet when nothing is left to lose', () => {
    expect(getReminders([withUses(8)], settings(), '2026-11-08')).toEqual([])
  })

  it('follows the shortest configured window and the on/off switch', () => {
    expect(
      summary(getReminders([withUses(3)], settings({ expiryReminderDays: [14, 5] }), '2026-11-05')),
    ).toEqual(['m:reset'])
    expect(
      getReminders([withUses(3)], settings({ expiryReminderDays: [14, 5] }), '2026-11-04'),
    ).toEqual([])
    expect(
      getReminders([withUses(3)], settings({ resetRemindersEnabled: false }), '2026-11-08'),
    ).toEqual([])
    expect(getReminders([withUses(3)], settings({ expiryReminderDays: [] }), '2026-11-08')).toEqual(
      [],
    )
  })

  it('is not raised when the membership ends before the next reset', () => {
    const ending = makeMonthly({ id: 'e', expiryDate: '2026-11-08' })
    const b = bundle(ending, { uses: makeUses('e', 3, '2026-10-12') })
    expect(summary(getReminders([b], settings(), '2026-11-08'))).toEqual(['e:expiring']) // only the end-date banner
  })

  it('stays hidden once dismissed until the next period (FR-34)', () => {
    const shown = getReminders([withUses(3)], settings(), '2026-11-08')[0]!
    expect(dismissalValue(shown)).toBe(20261110)
    const dismissed = settings({ dismissedReminders: { [shown.key]: dismissalValue(shown) } })
    expect(getReminders([withUses(3)], dismissed, '2026-11-09')).toEqual([])
    // A month later the next reset (10 Dec) is the one in range, so it shows again.
    const later = bundle(m, { uses: [makeUse('m', { usedAt: at('2026-11-12') })] })
    expect(summary(getReminders([later], dismissed, '2026-12-08'))).toEqual(['m:reset'])
  })

  it('never fires for an unlimited membership', () => {
    const unlimited = bundle(makeMembership({ id: 'u', expiryDate: '2027-10-31' }))
    expect(getReminders([unlimited], settings(), '2026-11-08')).toEqual([])
  })
})

describe('getReminders — dismissal (FR-34)', () => {
  it('hides a dismissed expiring banner while still in the same window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const shown = getReminders([bundle(pass)], settings(), today)[0]!
    expect(dismissalValue(shown)).toBe(14)
    const dismissed = settings({ dismissedReminders: { [shown.key]: dismissalValue(shown) } })
    expect(getReminders([bundle(pass)], dismissed, today)).toEqual([])
    expect(getReminders([bundle(pass)], dismissed, '2026-10-10')).toEqual([])
  })

  it('comes back in the 3-day window after being dismissed in the 14-day window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'expiring')]: 14 } })
    expect(getReminders([bundle(pass)], dismissed, '2026-10-10')).toEqual([])
    expect(getReminders([bundle(pass)], dismissed, '2026-10-12')).toHaveLength(1)
  })

  it('stays hidden once dismissed in the tightest window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'expiring')]: 3 } })
    expect(getReminders([bundle(pass)], dismissed, '2026-10-15')).toEqual([])
  })

  it('brings a dismissed low banner back when fewer entries are left', () => {
    const pass = makeCounted({ id: 'p', totalEntries: 10 })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'low')]: 2 } })
    expect(getReminders([bundle(pass, { uses: makeUses('p', 8) })], dismissed, today)).toEqual([])
    expect(getReminders([bundle(pass, { uses: makeUses('p', 9) })], dismissed, today)).toHaveLength(
      1,
    )
  })
})

describe('getReminders — ordering', () => {
  it('lists expiring first, then resets, then low ones, each soonest or fewest first', () => {
    const a = bundle(makeCounted({ id: 'a', expiryDate: '2026-10-12' }))
    const b = bundle(makeCounted({ id: 'b', expiryDate: '2026-10-05' }))
    const c = bundle(makeCounted({ id: 'c', totalEntries: 10 }), { uses: makeUses('c', 8) })
    const d = bundle(makeCounted({ id: 'd', totalEntries: 10 }), { uses: makeUses('d', 9) })
    const r = bundle(
      makeMonthly({ id: 'r', purchaseDate: '2026-09-03', expiryDate: '2027-09-02' }),
      { uses: makeUses('r', 2, '2026-09-10') },
    )
    expect(summary(getReminders([c, r, a, d, b], settings(), '2026-10-01'))).toEqual([
      'b:expiring',
      'a:expiring',
      'r:reset',
      'd:low',
      'c:low',
    ])
  })
})

describe('groupByPass', () => {
  it('a pass that is expiring and low is one banner that says it once', () => {
    const rs = getReminders(
      [
        bundle(
          makeCounted({ id: 'p', expiryDate: '2026-10-08', totalEntries: 10, initialUsed: 9 }),
        ),
      ],
      settings(),
      today,
    )
    expect(summary(rs)).toEqual(['p:expiring', 'p:low'])
    const [group, ...rest] = groupByPass(rs)
    expect(rest).toEqual([])
    expect(group!.passId).toBe('p')
    expect(group!.shown.map((r) => r.kind)).toEqual(['expiring']) // "expires …, 1 entry left"
    expect(group!.all.map((r) => r.kind)).toEqual(['expiring', 'low']) // both get dismissed
  })

  it('a pass that is only low keeps its low reminder', () => {
    const rs = getReminders([bundle(makeCounted({ id: 'p', initialUsed: 8 }))], settings(), today)
    const [group] = groupByPass(rs)
    expect(group!.shown.map((r) => r.kind)).toEqual(['low'])
  })

  it('different passes stay separate, in the order of their first reminder', () => {
    const rs = getReminders(
      [
        bundle(makeCounted({ id: 'low', initialUsed: 8 })),
        bundle(makeCounted({ id: 'soon', expiryDate: '2026-10-05' })),
      ],
      settings(),
      today,
    )
    expect(groupByPass(rs).map((g) => g.passId)).toEqual(['soon', 'low'])
  })

  it('a membership can be expiring and about to reset: both are said', () => {
    const rs = getReminders(
      [
        bundle(
          makeMonthly({
            id: 'm',
            purchaseDate: '2026-09-02',
            expiryDate: '2026-10-10',
            monthlyEntries: 8,
          }),
        ),
      ],
      settings(),
      today,
    )
    const [group] = groupByPass(rs)
    expect(group!.shown.map((r) => r.kind).sort()).toEqual(['expiring', 'reset'])
  })

  it('nothing in, nothing out', () => {
    expect(groupByPass([])).toEqual([])
  })
})
