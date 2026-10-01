import { DEFAULT_SETTINGS } from './settings'
import { orderUsablePasses, preselectPass } from './selection'
import { bundle, makeCounted, makeFreeze, makeMembership, makeUses } from './testFactories'

const today = '2026-10-01'
const ids = (bundles: ReturnType<typeof orderUsablePasses>) => bundles.map((b) => b.pass.id)

describe('orderUsablePasses / preselectPass (D6)', () => {
  it('puts the soonest-expiring pass first', () => {
    const late = bundle(makeCounted({ id: 'late', expiryDate: '2027-06-30' }))
    const soon = bundle(makeCounted({ id: 'soon', expiryDate: '2026-12-31' }))
    expect(ids(orderUsablePasses([late, soon], today, DEFAULT_SETTINGS))).toEqual(['soon', 'late'])
    expect(preselectPass([late, soon], today, DEFAULT_SETTINGS)?.pass.id).toBe('soon')
  })

  it('breaks expiry ties by fewest entries left, then purchase date, then creation time, then id', () => {
    const base = { expiryDate: '2026-12-31', totalEntries: 10 }
    const fewer = bundle(makeCounted({ ...base, id: 'fewer' }), { uses: makeUses('fewer', 8) })
    const more = bundle(makeCounted({ ...base, id: 'more' }))
    expect(ids(orderUsablePasses([more, fewer], today, DEFAULT_SETTINGS))).toEqual([
      'fewer',
      'more',
    ])

    const older = bundle(makeCounted({ ...base, id: 'older', purchaseDate: '2026-01-01' }))
    const newer = bundle(makeCounted({ ...base, id: 'newer', purchaseDate: '2026-02-01' }))
    expect(ids(orderUsablePasses([newer, older], today, DEFAULT_SETTINGS))).toEqual([
      'older',
      'newer',
    ])

    const first = bundle(makeCounted({ ...base, id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }))
    const second = bundle(makeCounted({ ...base, id: 'b', createdAt: '2026-01-02T00:00:00.000Z' }))
    expect(ids(orderUsablePasses([second, first], today, DEFAULT_SETTINGS))).toEqual(['a', 'b'])
    const twinA = bundle(makeCounted({ ...base, id: 'x' }))
    const twinB = bundle(makeCounted({ ...base, id: 'y' }))
    expect(ids(orderUsablePasses([twinB, twinA], today, DEFAULT_SETTINGS))).toEqual(['x', 'y'])
  })

  it('skips used-up, expired, deleted, future-dated and non-counted passes', () => {
    const usedUp = bundle(makeCounted({ id: 'used', totalEntries: 1 }), {
      uses: makeUses('used', 1),
    })
    const expired = bundle(makeCounted({ id: 'expired', expiryDate: '2026-09-30' }))
    const deleted = bundle(makeCounted({ id: 'deleted', deletedAt: '2026-09-01T00:00:00.000Z' }))
    const notYet = bundle(makeCounted({ id: 'future', purchaseDate: '2026-10-02' }))
    const membership = bundle(makeMembership({ id: 'member' }))
    const good = bundle(makeCounted({ id: 'good' }))
    const result = orderUsablePasses(
      [usedUp, expired, deleted, notYet, membership, good],
      today,
      DEFAULT_SETTINGS,
    )
    expect(ids(result)).toEqual(['good'])
  })

  it('still offers a pass that expires today', () => {
    const lastDay = bundle(makeCounted({ id: 'last', expiryDate: today }))
    expect(preselectPass([lastDay], today, DEFAULT_SETTINGS)?.pass.id).toBe('last')
  })

  it('returns null when nothing is usable', () => {
    const m = bundle(makeMembership(), { freezes: [makeFreeze('x', today, today)] })
    expect(preselectPass([m], today, DEFAULT_SETTINGS)).toBeNull()
    expect(preselectPass([], today, DEFAULT_SETTINGS)).toBeNull()
  })
})
