import { BUILTIN_GYMS } from './gyms'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('built-in gym data', () => {
  it('has unique, well-formed ids across gyms and templates', () => {
    const ids = BUILTIN_GYMS.flatMap((g) => [g.id, ...g.templates.map((t) => t.id)])
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(UUID)
  })

  it('has a name for every gym and unique gym names', () => {
    const names = BUILTIN_GYMS.map((g) => g.name.trim())
    for (const name of names) expect(name).not.toBe('')
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
  })

  it('gives counted templates an entry count and nothing else a stray one', () => {
    for (const { templates } of BUILTIN_GYMS) {
      for (const t of templates) {
        expect(t.name.trim()).not.toBe('')
        if (t.passType === 'multipass' || t.passType === 'class_pack') {
          expect(Number.isInteger(t.entries)).toBe(true)
          expect(t.entries).toBeGreaterThanOrEqual(1)
        } else {
          expect(t.entries).toBeNull()
        }
        if (t.passType === 'membership') expect(t.billingPeriod).not.toBeNull()
        else expect(t.billingPeriod).toBeNull()
      }
    }
  })

  it('never ships prices or validity periods (D11)', () => {
    const allowed = ['id', 'passType', 'name', 'entries', 'billingPeriod']
    for (const { templates } of BUILTIN_GYMS) {
      for (const t of templates) expect(Object.keys(t).sort()).toEqual([...allowed].sort())
    }
    for (const gym of BUILTIN_GYMS) {
      expect(Object.keys(gym).sort()).toEqual(['id', 'name', 'templates', 'website'])
    }
  })
})
