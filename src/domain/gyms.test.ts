import {
  buildGymList,
  cleanGymName,
  findGym,
  normalizeGymName,
  resolveGymInput,
  searchGyms,
  type BuiltinGym,
} from './gyms'
import type { UserGym } from './types'

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}
const builtin: BuiltinGym[] = [
  { id: 'b-planet', name: 'Boulder Planet' },
  { id: 'b-plus', name: 'Boulder+' },
  { id: 'b-fit', name: 'fit bloc' },
]
const userGym = (id: string, name: string, overrides: Partial<UserGym> = {}): UserGym => ({
  id,
  name,
  ...meta,
  ...overrides,
})
const names = (gyms: { name: string }[]) => gyms.map((g) => g.name)

describe('buildGymList', () => {
  it('merges built-in and user gyms, sorted by name ignoring case', () => {
    const gyms = buildGymList(builtin, [userGym('u1', 'Alpha Wall'), userGym('u2', 'zeta')])
    expect(names(gyms)).toEqual(['Alpha Wall', 'Boulder Planet', 'Boulder+', 'fit bloc', 'zeta'])
    expect(gyms[0]?.ref).toEqual({ kind: 'user', id: 'u1' })
    expect(gyms[1]?.ref).toEqual({ kind: 'builtin', id: 'b-planet' })
  })

  it('leaves out deleted user gyms', () => {
    expect(
      names(
        buildGymList(builtin, [userGym('u1', 'Gone', { deletedAt: '2026-02-01T00:00:00.000Z' })]),
      ),
    ).not.toContain('Gone')
  })

  it('finds a gym by kind and id', () => {
    const gyms = buildGymList(builtin, [userGym('b-planet', 'Same id, user gym')])
    expect(findGym(gyms, { kind: 'builtin', id: 'b-planet' })?.name).toBe('Boulder Planet')
    expect(findGym(gyms, { kind: 'user', id: 'b-planet' })?.name).toBe('Same id, user gym')
    expect(findGym(gyms, { kind: 'user', id: 'nope' })).toBeUndefined()
  })
})

describe('normalizeGymName / cleanGymName', () => {
  it('ignores case, punctuation and spacing, and reads "+" as "plus"', () => {
    expect(normalizeGymName('  Boulder+ ')).toBe('boulder plus')
    expect(normalizeGymName('BOULDER   Plus')).toBe('boulder plus')
    expect(normalizeGymName('Fit-Bloc!')).toBe('fit bloc')
    expect(normalizeGymName('???')).toBe('')
  })

  it('trims and collapses spaces but keeps the letters as typed', () => {
    expect(cleanGymName('  My   Wall \n')).toBe('My Wall')
    expect(cleanGymName('Boulder+')).toBe('Boulder+')
  })
})

describe('searchGyms', () => {
  const gyms = buildGymList(builtin, [userGym('u1', 'The Climbing Depot')])

  it('returns everything for an empty query', () => {
    expect(searchGyms(gyms, '')).toEqual(gyms)
    expect(searchGyms(gyms, '   ')).toEqual(gyms)
  })

  it('ignores case and matches parts of the name', () => {
    expect(names(searchGyms(gyms, 'PLANET'))).toEqual(['Boulder Planet'])
    expect(names(searchGyms(gyms, 'plan'))).toEqual(['Boulder Planet'])
    expect(names(searchGyms(gyms, 'depot climbing'))).toEqual(['The Climbing Depot'])
  })

  it('treats "+" as "plus" so typing the symbol or the word both work', () => {
    expect(names(searchGyms(gyms, 'boulder+'))).toEqual(['Boulder+'])
    expect(names(searchGyms(gyms, 'boulder plus'))).toEqual(['Boulder+'])
    expect(names(searchGyms(gyms, 'boulder'))).toEqual(['Boulder Planet', 'Boulder+'])
  })

  it('returns nothing when no gym matches', () => {
    expect(searchGyms(gyms, 'zzz')).toEqual([])
  })
})

describe('resolveGymInput (D24, FR-25, FR-53)', () => {
  const gyms = buildGymList(builtin, [userGym('u1', 'My Wall')])

  it('uses an existing gym when the text equals one ignoring case and punctuation', () => {
    expect(resolveGymInput('boulder planet', gyms)).toMatchObject({
      kind: 'existing',
      gym: { name: 'Boulder Planet' },
    })
    expect(resolveGymInput('  BOULDER   PLANET ', gyms)).toMatchObject({ kind: 'existing' })
    expect(resolveGymInput('boulder plus', gyms)).toMatchObject({
      kind: 'existing',
      gym: { name: 'Boulder+' },
    })
    expect(resolveGymInput('my wall', gyms)).toMatchObject({
      kind: 'existing',
      gym: { ref: { kind: 'user', id: 'u1' } },
    })
  })

  it('does not treat a partial name as a match: that is a new gym', () => {
    expect(resolveGymInput('Boulder', gyms)).toEqual({ kind: 'new', name: 'Boulder' })
    expect(resolveGymInput('  Zig   Zag Wall ', gyms)).toEqual({
      kind: 'new',
      name: 'Zig Zag Wall',
    })
  })

  it('has nothing to use for empty or symbol-only text', () => {
    expect(resolveGymInput('', gyms)).toEqual({ kind: 'empty' })
    expect(resolveGymInput('   ', gyms)).toEqual({ kind: 'empty' })
    expect(resolveGymInput('?!', gyms)).toEqual({ kind: 'empty' })
  })

  it('prefers a built-in gym when a user gym has the same name', () => {
    const both = buildGymList(builtin, [userGym('u9', 'Boulder Planet')])
    expect(resolveGymInput('boulder planet', both)).toMatchObject({
      kind: 'existing',
      gym: { ref: { kind: 'builtin' } },
    })
  })
})
