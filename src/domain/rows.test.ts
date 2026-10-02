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

describe('buildRows', () => {
  it('lists active passes by soonest expiry (D31)', () => {
    const late = bundle(makeCounted({ id: 'late', expiryDate: '2027-06-30' }))
    const soon = bundle(makeCounted({ id: 'soon', expiryDate: '2026-12-31' }))
    const member = bundle(makeMembership({ id: 'member', expiryDate: '2027-01-31' }))
    expect(ids(build([late, member, soon]).active)).toEqual(['soon', 'member', 'late'])
  })

  it('does not group by gym: two passes at one gym are two separate rows (D23)', () => {
    const gymRef = { kind: 'builtin', id: 'fitbloc' } as const
    const a = bundle(makeCounted({ id: 'a', gymRef, expiryDate: '2027-03-01' }))
    const other = bundle(makeCounted({ id: 'o', expiryDate: '2027-01-01' }))
    const b = bundle(makeCounted({ id: 'b', gymRef, expiryDate: '2027-06-01' }))
    const rows = build([a, other, b]).active
    expect(ids(rows)).toEqual(['o', 'a', 'b']) // the Fit Bloc rows are not kept together
    expect(rows.map((r) => r.gymName)).toEqual(['Gym gym-a', 'Gym fitbloc', 'Gym fitbloc'])
  })

  it('puts passes with no expiry last', () => {
    const single = bundle(makeSingle({ id: 'single' }))
    const dated = bundle(makeCounted({ id: 'dated', expiryDate: '2099-01-01' }))
    expect(ids(build([single, dated]).active)).toEqual(['dated', 'single'])
  })

  it('breaks expiry ties by fewest entries left, then purchase date, creation time and id', () => {
    const base = { expiryDate: '2026-12-31', totalEntries: 10 }
    const fewer = bundle(makeCounted({ ...base, id: 'fewer' }), { uses: makeUses('fewer', 8) })
    const more = bundle(makeCounted({ ...base, id: 'more' }))
    expect(ids(build([more, fewer]).active)).toEqual(['fewer', 'more'])

    const older = bundle(makeCounted({ ...base, id: 'older', purchaseDate: '2026-01-01' }))
    const newer = bundle(makeCounted({ ...base, id: 'newer', purchaseDate: '2026-02-01' }))
    expect(ids(build([newer, older]).active)).toEqual(['older', 'newer'])

    const first = bundle(makeCounted({ ...base, id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }))
    const second = bundle(makeCounted({ ...base, id: 'b', createdAt: '2026-01-02T00:00:00.000Z' }))
    expect(ids(build([second, first]).active)).toEqual(['a', 'b'])
    expect(
      ids(
        build([
          bundle(makeCounted({ ...base, id: 'y' })),
          bundle(makeCounted({ ...base, id: 'x' })),
        ]).active,
      ),
    ).toEqual(['x', 'y'])
  })

  it('moves used-up and expired passes to Finished, latest expiry first', () => {
    const usedUp = makeCounted({ id: 'used', totalEntries: 1, expiryDate: '2027-02-01' })
    const expiredEarly = makeCounted({ id: 'early', expiryDate: '2026-08-01' })
    const expiredLate = makeCounted({ id: 'late', expiryDate: '2026-09-20' })
    const endedMember = makeMembership({ id: 'ended', expiryDate: '2026-09-30' })
    const usedSingle = makeSingle({ id: 'single', initialUsed: 1 })
    const live = makeCounted({ id: 'live', expiryDate: '2027-05-01' })
    const rows = build([
      bundle(expiredEarly),
      bundle(usedUp, { uses: makeUses('used', 1) }),
      bundle(live),
      bundle(expiredLate),
      bundle(endedMember),
      bundle(usedSingle),
    ])
    expect(ids(rows.active)).toEqual(['live'])
    expect(ids(rows.finished)).toEqual(['used', 'ended', 'late', 'early', 'single'])
    expect(rows.finished.find((r) => r.pass.id === 'early')?.status).toMatchObject({
      state: 'expired',
      unused: 10,
    })
  })

  it('keeps a monthly membership at 0 in the main list, and a frozen membership too', () => {
    const m = makeMonthly({ id: 'm' })
    const allUsed = bundle(m, { uses: makeUses('m', 8, '2026-10-12') })
    const frozen = makeMembership({ id: 'f', expiryDate: '2026-10-31' })
    const rows = buildRows(
      [allUsed, bundle(frozen, { freezes: [makeFreeze('f', '2026-09-30', '2026-10-05')] })],
      gymName,
      '2026-10-20',
      DEFAULT_SETTINGS,
    )
    expect(ids(rows.active)).toEqual(['f', 'm'])
    expect(rows.finished).toEqual([])
    expect(rows.active[1]?.status).toMatchObject({
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
      bundle(makeCounted({ id: 'a' })),
      bundle(makeCounted({ id: 'gone', deletedAt: '2026-09-01T00:00:00.000Z' })),
      bundle(makeMembership({ id: 'm', expiryDate: '2026-11-30' })),
    ])
    expect(rows.active.map((r) => [r.pass.id, r.typeLabel])).toEqual([
      ['m', 'Membership'],
      ['a', 'Multipass'],
    ])
  })
})
