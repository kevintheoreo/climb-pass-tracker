import { buildGymList, resolveGymInput } from '../domain/gyms'
import { BUILTIN_GYMS } from './gyms'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('built-in gym data', () => {
  it('has unique, well-formed ids', () => {
    const ids = BUILTIN_GYMS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(UUID)
  })

  it('has a name for every gym and unique names', () => {
    const names = BUILTIN_GYMS.map((g) => g.name.trim())
    for (const name of names) expect(name).not.toBe('')
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
  })

  it('holds names only: no pass options, prices or validity periods (D11)', () => {
    for (const gym of BUILTIN_GYMS) expect(Object.keys(gym).sort()).toEqual(['id', 'name'])
  })

  it("is the owner's checked list: 20 gyms, spelled as given (D22, plan step 3.1)", () => {
    expect(BUILTIN_GYMS.map((g) => g.name).sort()).toEqual(
      [
        'BFF Climb (All Outlets)',
        'BFF Climb (Tampines)',
        'Boulder Movement',
        'Boulder Planet',
        'boulder+',
        'Climb Central',
        'fit·bloc',
        'Ark Bloc',
        'Climb@T3',
        'Climba',
        'ClimbUp',
        'Ground Up Climbing',
        'Kinetics Climbing',
        'Lighthouse Climbing',
        'My Little Climbing Room',
        'Outpost Climbing',
        'OYEYO Boulder Home',
        'Upwall Climbing',
        'Verticlimb',
        'Z-Vertigo Boulder Gym',
      ].sort(),
    )
  })

  it('keeps these ids for ever: passes and backup files point at them', () => {
    const byName = Object.fromEntries(BUILTIN_GYMS.map((g) => [g.name, g.id]))
    expect(byName['fit·bloc']).toBe('d9fcadad-6459-4df9-9c7c-c89587bf1f33')
    expect(byName['boulder+']).toBe('a52e157a-02c3-4fdb-8f36-daaed051ee7d')
    expect(byName['Z-Vertigo Boulder Gym']).toBe('80e340a8-95b3-4934-bf4d-2036eff89276')
  })

  it('has no two gyms that the gym box would treat as the same', () => {
    const gyms = buildGymList(BUILTIN_GYMS, [])
    for (const gym of gyms) {
      const found = resolveGymInput(gym.name, gyms)
      expect(found).toMatchObject({ kind: 'existing', gym: { name: gym.name } })
    }
  })

  it('finds each gym however people type its name', () => {
    const gyms = buildGymList(BUILTIN_GYMS, [])
    const typed: [string, string][] = [
      ['Fitbloc', 'fit·bloc'],
      ['fit bloc', 'fit·bloc'],
      ['FIT-BLOC', 'fit·bloc'],
      ['Boulder+', 'boulder+'],
      ['boulder plus', 'boulder+'],
      ['climb@t3', 'Climb@T3'],
      ['climb t3', 'Climb@T3'],
      ['z vertigo boulder gym', 'Z-Vertigo Boulder Gym'],
      ['zvertigo boulder gym', 'Z-Vertigo Boulder Gym'],
      ['oyeyo boulder home', 'OYEYO Boulder Home'],
      ['climb up', 'ClimbUp'],
      ['BFF CLIMB (TAMPINES)', 'BFF Climb (Tampines)'],
    ]
    for (const [text, name] of typed) {
      expect(resolveGymInput(text, gyms), text).toMatchObject({
        kind: 'existing',
        gym: { name },
      })
    }
  })

  it('treats a partly typed name as a new gym, not a match', () => {
    const gyms = buildGymList(BUILTIN_GYMS, [])
    expect(resolveGymInput('BFF Climb', gyms)).toMatchObject({ kind: 'new' })
    expect(resolveGymInput('Climb', gyms)).toMatchObject({ kind: 'new' })
  })
})
