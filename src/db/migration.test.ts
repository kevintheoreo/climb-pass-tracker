import Dexie from 'dexie'
import { ClimbDB } from './db'
import { createRepo } from './repo'

// The database as the earlier multi-screen design created it (version 1).
class OldDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(1).stores({
      passes: 'id, updatedAt, passType, gymRef.id',
      uses: 'id, passId, usedAt, updatedAt',
      freezes: 'id, passId, updatedAt',
      userGyms: 'id, updatedAt',
      userTemplates: 'id, gymRef.id, updatedAt',
      hiddenGyms: 'id, updatedAt',
      settings: 'id',
      meta: 'key',
    })
  }
}

const meta = {
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  deletedAt: null,
}

describe('database upgrade from the multi-screen design (version 1 → 2)', () => {
  it('clears the old pass rows, drops templates and hidden gyms, and keeps gyms and settings', async () => {
    const name = 'migration-test'
    const old = new OldDB(name)
    await old.table('passes').add({
      id: 'p1',
      gymRef: { kind: 'user', id: 'u1' },
      passType: 'multipass',
      name: '10-Pass',
      ...meta,
    })
    await old
      .table('uses')
      .add({ id: 'use1', passId: 'p1', usedAt: '2026-09-02T00:00:00.000Z', note: null, ...meta })
    await old
      .table('freezes')
      .add({ id: 'f1', passId: 'p1', startDate: '2026-09-01', endDate: '2026-09-02', ...meta })
    await old.table('userTemplates').add({ id: 't1', gymRef: { kind: 'user', id: 'u1' }, ...meta })
    await old.table('hiddenGyms').add({ id: 'h1', ...meta })
    await old.table('userGyms').add({ id: 'u1', name: 'My Wall', website: null, ...meta })
    await old.table('settings').add({ id: 'settings', updatedAt: 'x', lowEntriesThreshold: 5 })
    await old.table('meta').add({ key: 'deviceId', value: 'abc' })
    old.close()

    const upgraded = new ClimbDB(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(3)
    expect(upgraded.tables.map((t) => t.name).sort()).toEqual([
      'freezes',
      'meta',
      'passes',
      'settings',
      'userGyms',
      'uses',
    ])
    expect(await upgraded.passes.count()).toBe(0)
    expect(await upgraded.uses.count()).toBe(0)
    expect(await upgraded.freezes.count()).toBe(0)
    expect(await upgraded.userGyms.count()).toBe(1)
    expect((await upgraded.settings.get('settings'))?.lowEntriesThreshold).toBe(5)
    expect((await upgraded.meta.get('deviceId'))?.value).toBe('abc')

    // And the upgraded database works with the new pass shape.
    const repo = createRepo(upgraded)
    const pass = await repo.createPass({
      gymRef: { kind: 'user', id: 'u1' },
      passType: 'multipass',
      priceCents: null,
      comments: null,
      purchaseDate: '2026-10-01',
      expiryDate: '2027-04-01',
      totalEntries: 10,
      initialUsed: 0,
    })
    expect(await repo.getPass(pass.id)).toEqual(pass)
    upgraded.close()
  })

  it('a brand-new database starts straight at version 3', async () => {
    const fresh = new ClimbDB('fresh-install')
    await fresh.open()
    expect(fresh.verno).toBe(3)
    fresh.close()
  })
})

// The database as version 2 created it, when deleting a pass only flagged it.
class V2DB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(2).stores({
      passes: 'id, updatedAt, passType, gymRef.id',
      uses: 'id, passId, usedAt, updatedAt',
      freezes: 'id, passId, updatedAt',
      userGyms: 'id, updatedAt',
      settings: 'id',
      meta: 'key',
    })
  }
}

describe('database upgrade to hard deletes (version 2 → 3)', () => {
  it('purges passes flagged deleted, with their uses and freezes, and keeps everything else', async () => {
    const name = 'migration-v3-test'
    const old = new V2DB(name)
    const pass = (id: string, deletedAt: string | null) => ({
      id,
      gymRef: { kind: 'user', id: 'u1' },
      passType: 'multipass',
      ...meta,
      deletedAt,
    })
    await old
      .table('passes')
      .bulkAdd([pass('keep', null), pass('gone', '2026-09-05T00:00:00.000Z')])
    const use = (id: string, passId: string, deletedAt: string | null) => ({
      id,
      passId,
      usedAt: '2026-09-02T00:00:00.000Z',
      ...meta,
      deletedAt,
    })
    await old
      .table('uses')
      .bulkAdd([
        use('u-keep', 'keep', null),
        use('u-undone', 'keep', '2026-09-03T00:00:00.000Z'),
        use('u-gone', 'gone', '2026-09-05T00:00:00.000Z'),
        use('u-orphan', 'missing', null),
      ])
    await old.table('freezes').bulkAdd([
      { id: 'f-keep', passId: 'keep', startDate: '2026-09-01', endDate: '2026-09-02', ...meta },
      { id: 'f-gone', passId: 'gone', startDate: '2026-09-01', endDate: '2026-09-02', ...meta },
    ])
    await old.table('userGyms').add({ id: 'u1', name: 'My Wall', ...meta })
    old.close()

    const upgraded = new ClimbDB(name)
    await upgraded.open()
    expect((await upgraded.passes.toArray()).map((p) => p.id)).toEqual(['keep'])
    expect((await upgraded.uses.toArray()).map((u) => u.id).sort()).toEqual(['u-keep', 'u-undone'])
    expect((await upgraded.freezes.toArray()).map((f) => f.id)).toEqual(['f-keep'])
    expect(await upgraded.userGyms.count()).toBe(1)
    upgraded.close()
  })
})
