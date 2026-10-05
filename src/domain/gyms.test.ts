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
  { id: 'b-planet', name: 'Boulder Planet', isActive: true },
  { id: 'b-plus', name: 'Boulder+', isActive: true },
  { id: 'b-fit', name: 'fit bloc', isActive: true },
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
    expect(normalizeGymName('  Boulder+ ')).toBe('boulderplus')
    expect(normalizeGymName('BOULDER   Plus')).toBe('boulderplus')
    expect(normalizeGymName('Fit-Bloc!')).toBe('fitbloc')
    expect(normalizeGymName('???')).toBe('')
  })

  it('treats a gym written as one word, as two words or with a dot between as the same', () => {
    const same = ['Fitbloc', 'fit bloc', 'FIT·BLOC', 'fit-bloc', 'Fit.Bloc'].map(normalizeGymName)
    expect(new Set(same).size).toBe(1)
    expect(normalizeGymName('Climb@T3')).toBe(normalizeGymName('climb t3'))
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

  it('finds a gym whether or not the spaces and dots are typed', () => {
    const real = buildGymList([{ id: 'x', name: 'fit·bloc', isActive: true }], [])
    for (const typed of ['fitbloc', 'fit bloc', 'Fit·Bloc', 'fit', 'bloc']) {
      expect(names(searchGyms(real, typed))).toEqual(['fit·bloc'])
    }
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

describe('retired gyms (isActive: false)', () => {
  const retired: BuiltinGym[] = [
    { id: 'b-old', name: 'Old Wall', isActive: false },
    { id: 'b-new', name: 'New Wall', isActive: true },
  ]
  const list = buildGymList(retired, [userGym('u1', 'Old Wall Annex')])

  it('are not suggested, whether or not anything is typed', () => {
    expect(names(searchGyms(list, ''))).toEqual(['New Wall', 'Old Wall Annex'])
    expect(names(searchGyms(list, 'wall'))).toEqual(['New Wall', 'Old Wall Annex'])
    expect(names(searchGyms(list, 'old wall'))).toEqual(['Old Wall Annex'])
  })

  it('still name the passes that already use them', () => {
    expect(findGym(list, { kind: 'builtin', id: 'b-old' })?.name).toBe('Old Wall')
  })

  it('are reused when their exact name is typed, so no duplicate is created', () => {
    const choice = resolveGymInput('old  wall', list)
    expect(choice).toMatchObject({ kind: 'existing', gym: { ref: { id: 'b-old' } } })
  })

  it('lose an exact-name tie to an active gym', () => {
    const tied = buildGymList(retired, [userGym('u2', 'old wall')])
    expect(resolveGymInput('Old Wall', tied)).toMatchObject({
      kind: 'existing',
      gym: { ref: { kind: 'user', id: 'u2' } },
    })
  })
})
