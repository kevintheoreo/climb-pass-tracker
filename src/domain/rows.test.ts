import { DEFAULT_SETTINGS } from './settings'
import { buildRows } from './rows'
import type { GymRef } from './types'
import {
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUses,
} from './testFactories'

const today = '2026-10-01'
const gymName = (ref: GymRef) => `Gym ${ref.id}`
const ids = (rows: { pass: { id: string } }[]) => rows.map((r) => r.pass.id)
const build = (bundles: ReturnType<typeof bundle>[]) =>
  buildRows(bundles, gymName, today, DEFAULT_SETTINGS)

/** A creation time `n` days into 2026, so a bigger `n` was added later. */
const added = (n: number) => `2026-01-${String(n).padStart(2, '0')}T09:00:00.000Z`

describe('buildRows', () => {
  it('lists active passes newest first, by when they were added (D41)', () => {
    const first = bundle(
      makeCounted({ id: 'first', createdAt: added(1), expiryDate: '2026-12-31' }),
    )
    const second = bundle(
      makeMembership({ id: 'second', createdAt: added(2), expiryDate: '2027-01-31' }),
    )
    const third = bundle(
      makeCounted({ id: 'third', createdAt: added(3), expiryDate: '2027-06-30' }),
    )
    expect(ids(build([second, first, third]).active)).toEqual(['third', 'second', 'first'])
  })

  it('does not sort by expiry, entries left or purchase date', () => {
    const soonest = bundle(
      makeCounted({ id: 'soonest', createdAt: added(1), expiryDate: '2026-11-01' }),
    )
    const noExpiry = bundle(makeSingle({ id: 'none', createdAt: added(2) }))
    const latest = bundle(
      makeCounted({
        id: 'latest',
        createdAt: added(3),
        purchaseDate: '2020-01-01',
        expiryDate: '2099-01-01',
      }),
    )
    expect(ids(build([soonest, noExpiry, latest]).active)).toEqual(['latest', 'none', 'soonest'])
  })

  it('does not group by gym: two passes at one gym are two separate rows (D23)', () => {
    const gymRef = { kind: 'builtin', id: 'fitbloc' } as const
    const a = bundle(makeCounted({ id: 'a', gymRef, createdAt: added(1) }))
    const other = bundle(makeCounted({ id: 'o', createdAt: added(2) }))
    const b = bundle(makeCounted({ id: 'b', gymRef, createdAt: added(3) }))
    const rows = build([a, other, b]).active
    expect(ids(rows)).toEqual(['b', 'o', 'a']) // the Fit Bloc rows are not kept together
    expect(rows.map((r) => r.gymName)).toEqual(['Gym fitbloc', 'Gym gym-a', 'Gym fitbloc'])
  })

  it('breaks a tie in creation time by id, so the order never jumps around', () => {
    const same = { createdAt: added(5) }
    const forward = ids(
      build([bundle(makeCounted({ ...same, id: 'x' })), bundle(makeCounted({ ...same, id: 'y' }))])
        .active,
    )
    const backward = ids(
      build([bundle(makeCounted({ ...same, id: 'y' })), bundle(makeCounted({ ...same, id: 'x' }))])
        .active,
    )
    expect(forward).toEqual(['y', 'x'])
    expect(backward).toEqual(forward)
  })

  it('moves used-up and expired passes to Finished, in the same order', () => {
    const usedUp = makeCounted({ id: 'used', createdAt: added(2), totalEntries: 1 })
    const expiredEarly = makeCounted({ id: 'early', createdAt: added(1), expiryDate: '2026-08-01' })
    const expiredLate = makeCounted({ id: 'late', createdAt: added(5), expiryDate: '2026-09-20' })
    const endedMember = makeMembership({
      id: 'ended',
      createdAt: added(4),
      expiryDate: '2026-09-30',
    })
    const usedSingle = makeSingle({ id: 'single', createdAt: added(3), initialUsed: 1 })
    const live = makeCounted({ id: 'live', createdAt: added(6), expiryDate: '2027-05-01' })
    const rows = build([
      bundle(expiredEarly),
      bundle(usedUp, { uses: makeUses('used', 1) }),
      bundle(live),
      bundle(expiredLate),
      bundle(endedMember),
      bundle(usedSingle),
    ])
    expect(ids(rows.active)).toEqual(['live'])
    expect(ids(rows.finished)).toEqual(['late', 'ended', 'single', 'used', 'early'])
    expect(rows.finished.find((r) => r.pass.id === 'early')?.status).toMatchObject({
      state: 'expired',
      unused: 10,
    })
  })

  it('keeps a monthly membership at 0 in the main list, and a frozen membership too', () => {
    const m = makeMonthly({ id: 'm', createdAt: added(2) })
    const allUsed = bundle(m, { uses: makeUses('m', 8, '2026-10-12') })
    const frozen = makeMembership({ id: 'f', createdAt: added(1), expiryDate: '2026-10-31' })
    const rows = buildRows(
      [allUsed, bundle(frozen, { freezes: [makeFreeze('f', '2026-09-30', '2026-10-05')] })],
      gymName,
      '2026-10-20',
      DEFAULT_SETTINGS,
    )
    expect(ids(rows.active)).toEqual(['m', 'f'])
    expect(rows.finished).toEqual([])
    expect(rows.active[0]?.status).toMatchObject({
      entriesLeft: 0,
      total: 8,
      nextReset: '2026-11-10',
    })
  })

  it("shows a membership's freeze-extended end date as its expiry", () => {
    const m = makeMembership({ id: 'm', expiryDate: '2026-10-31' })
    const rows = build([bundle(m, { freezes: [makeFreeze('m', '2026-10-10', '2026-10-16')] })])
    expect(rows.active[0]?.expiry).toBe('2026-11-07')
  })

  it('labels each row with its type and skips deleted passes', () => {
    const rows = build([
      bundle(makeCounted({ id: 'a', createdAt: added(1) })),
      bundle(
        makeCounted({ id: 'gone', createdAt: added(2), deletedAt: '2026-09-01T00:00:00.000Z' }),
      ),
      bundle(makeMembership({ id: 'm', createdAt: added(3), expiryDate: '2026-11-30' })),
    ])
    expect(rows.active.map((r) => [r.pass.id, r.typeLabel])).toEqual([
      ['m', 'Membership'],
      ['a', 'Multipass'],
    ])
  })
})
