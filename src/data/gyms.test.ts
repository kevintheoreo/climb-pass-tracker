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
})
