import { DEFAULT_SETTINGS, type Settings } from './settings'
import { dismissalValue, getReminders, reminderKey } from './reminders'
import {
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeSingle,
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
    expect(getReminders([b('2026-10-04')], settings(), today)[0]?.window).toBe(3) // 3 days
    expect(getReminders([b('2026-10-05')], settings(), today)[0]?.window).toBe(14) // 4 days
    expect(getReminders([b('2026-10-01')], settings(), today)[0]?.window).toBe(3) // 0 days
  })

  it('also covers memberships', () => {
    const m = bundle(makeMembership({ id: 'm', endDate: '2026-10-10' }))
    expect(summary(getReminders([m], settings(), today))).toEqual(['m:expiring'])
  })

  it('stays quiet for passes with nothing to lose or that are not active', () => {
    const usedUp = bundle(makeCounted({ id: 'a', totalEntries: 1, expiryDate: '2026-10-05' }), {
      uses: makeUses('a', 1),
    })
    const expired = bundle(makeCounted({ id: 'b', expiryDate: '2026-09-30' }))
    const single = bundle(makeSingle({ id: 'c' }))
    const frozen = bundle(makeMembership({ id: 'd', endDate: '2026-10-10' }), {
      freezes: [makeFreeze('d', today, '2026-10-02')],
    })
    const deleted = bundle(
      makeCounted({ id: 'e', expiryDate: '2026-10-05', deletedAt: '2026-09-01T00:00:00.000Z' }),
    )
    expect(getReminders([usedUp, expired, single, frozen, deleted], settings(), today)).toEqual([])
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

  it('never applies to memberships, and respects the switch and threshold', () => {
    const m = bundle(makeMembership({ id: 'm' }))
    expect(getReminders([m], settings(), today)).toEqual([])
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

describe('getReminders — dismissal (FR-34)', () => {
  it('hides a dismissed expiring banner while still in the same window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const shown = getReminders([bundle(pass)], settings(), today)[0]!
    expect(dismissalValue(shown)).toBe(14)
    const dismissed = settings({ dismissedReminders: { [shown.key]: dismissalValue(shown) } })
    expect(getReminders([bundle(pass)], dismissed, today)).toEqual([]) // 14 days left
    expect(getReminders([bundle(pass)], dismissed, '2026-10-10')).toEqual([]) // 5 days left
  })

  it('comes back in the 3-day window after being dismissed in the 14-day window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'expiring')]: 14 } })
    expect(getReminders([bundle(pass)], dismissed, '2026-10-10')).toEqual([]) // 5 days left
    expect(getReminders([bundle(pass)], dismissed, '2026-10-12')).toHaveLength(1) // 3 days left
  })

  it('stays hidden once dismissed in the tightest window', () => {
    const pass = makeCounted({ id: 'p', expiryDate: '2026-10-15' })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'expiring')]: 3 } })
    expect(getReminders([bundle(pass)], dismissed, '2026-10-15')).toEqual([])
  })

  it('brings a dismissed low banner back when fewer entries are left', () => {
    const pass = makeCounted({ id: 'p', totalEntries: 10 })
    const dismissed = settings({ dismissedReminders: { [reminderKey('p', 'low')]: 2 } })
    expect(getReminders([bundle(pass, { uses: makeUses('p', 8) })], dismissed, today)).toEqual([]) // still 2
    expect(getReminders([bundle(pass, { uses: makeUses('p', 9) })], dismissed, today)).toHaveLength(
      1,
    ) // now 1
  })
})

describe('getReminders — ordering', () => {
  it('lists expiring first (soonest first), then low (fewest first)', () => {
    const a = bundle(makeCounted({ id: 'a', expiryDate: '2026-10-12' }))
    const b = bundle(makeCounted({ id: 'b', expiryDate: '2026-10-05' }))
    const c = bundle(makeCounted({ id: 'c', totalEntries: 10 }), { uses: makeUses('c', 8) }) // 2 left
    const d = bundle(makeCounted({ id: 'd', totalEntries: 10 }), { uses: makeUses('d', 9) }) // 1 left
    expect(summary(getReminders([c, a, d, b], settings(), today))).toEqual([
      'b:expiring',
      'a:expiring',
      'd:low',
      'c:low',
    ])
  })
})
