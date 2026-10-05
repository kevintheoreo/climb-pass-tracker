import { ZodError } from 'zod'
import { backupToText, parseBackup, type Backup } from '../domain/backup'
import { at, makeUse } from '../domain/testFactories'
import { getPassStatus } from '../domain/passStatus'
import { DEFAULT_SETTINGS } from '../domain/settings'
import type { PassInput } from '../domain/types'
import { ClimbDB } from './db'
import { createRepo, NotFoundError } from './repo'
import { makeTestRepo } from './testRepo'

const gymRef = { kind: 'builtin', id: 'b-fitbloc' } as const
const today = '2026-10-15'

const multipass = (overrides: Record<string, unknown> = {}): PassInput =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: 12000,
    comments: null,
    purchaseDate: '2026-01-01',
    expiryDate: '2026-12-31',
    totalEntries: 10,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

const single = (overrides: Record<string, unknown> = {}): PassInput =>
  ({
    gymRef,
    passType: 'single_entry',
    priceCents: null,
    comments: null,
    purchaseDate: '2026-10-01',
    expiryDate: null,
    totalEntries: 1,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

const membership = (overrides: Record<string, unknown> = {}): PassInput =>
  ({
    gymRef,
    passType: 'membership',
    priceCents: null,
    comments: null,
    purchaseDate: '2026-10-10',
    expiryDate: '2027-10-09',
    monthlyEntries: null,
    resetDay: null,
    ...overrides,
  }) as PassInput

describe('passes', () => {
  it('creates a pass with id and timestamps and reads it back', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    expect(pass).toMatchObject({ id: 'id-1', deletedAt: null, totalEntries: 10 })
    expect(pass.createdAt).toBe(pass.updatedAt)
    expect(await repo.getPass('id-1')).toEqual(pass)
    expect(await repo.listPasses()).toEqual([pass])
  })

  it('rejects invalid input without writing anything (FR-22)', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.createPass(multipass({ totalEntries: 0 }))).rejects.toBeInstanceOf(ZodError)
    await expect(repo.createPass(multipass({ expiryDate: '2025-12-31' }))).rejects.toBeInstanceOf(
      ZodError,
    )
    expect(await repo.listPasses()).toEqual([])
  })

  it('stores a membership with a monthly allowance and a single entry with no expiry', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership({ monthlyEntries: 8, resetDay: 15 }))
    const s = await repo.createPass(single())
    expect(m).toMatchObject({ monthlyEntries: 8, resetDay: 15 })
    expect(s).toMatchObject({ expiryDate: null, totalEntries: 1 })
  })

  it('records entries already used this month for a monthly membership, only for this period', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(membership({ monthlyEntries: 8 }), {
      usedThisPeriod: 3,
      today,
    })
    const [bundle] = await repo.listBundles()
    expect(bundle?.uses).toHaveLength(3)
    // This period: 15 Oct is in the period that started 10 Oct, so 5 are left...
    expect(getPassStatus(pass, bundle!.uses, [], today, DEFAULT_SETTINGS).entriesLeft).toBe(5)
    // ...and at the next reset (10 Nov) they stop counting.
    expect(getPassStatus(pass, bundle!.uses, [], '2026-11-10', DEFAULT_SETTINGS).entriesLeft).toBe(
      8,
    )
  })

  it('refuses "used this month" for other passes or more than the allowance', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.createPass(multipass(), { usedThisPeriod: 2, today })).rejects.toThrow(
      'monthly count',
    )
    await expect(
      repo.createPass(membership({ monthlyEntries: 8 }), { usedThisPeriod: 9, today }),
    ).rejects.toThrow('up to 8')
    await expect(
      repo.createPass(membership({ monthlyEntries: 8 }), { usedThisPeriod: 1.5, today }),
    ).rejects.toThrow()
    expect(await repo.listPasses()).toEqual([]) // the pass was rolled back with the failed uses
  })

  it('updates fields, keeps createdAt and bumps updatedAt', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    const updated = await repo.updatePass(
      created.id,
      multipass({ expiryDate: '2027-03-31', comments: 'extended' }),
    )
    expect(updated).toMatchObject({
      id: created.id,
      expiryDate: '2027-03-31',
      comments: 'extended',
    })
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt > created.updatedAt).toBe(true)
    expect(await repo.getPass(created.id)).toEqual(updated)
  })

  it('lets a row change type, and validates and finds the pass on update', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    const changed = await repo.updatePass(created.id, membership())
    expect(changed).toMatchObject({ id: created.id, passType: 'membership' })
    expect(changed).not.toHaveProperty('totalEntries')
    await expect(
      repo.updatePass(created.id, multipass({ totalEntries: 0 })),
    ).rejects.toBeInstanceOf(ZodError)
    await expect(repo.updatePass('nope', multipass())).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deleting a pass removes it for good: nothing is left in the table', async () => {
    const { repo, db } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    await repo.deletePass(pass.id)
    expect(await repo.getPass(pass.id)).toBeUndefined()
    expect(await repo.listPasses()).toEqual([])
    expect(await db.passes.get(pass.id)).toBeUndefined()
    await expect(repo.deletePass(pass.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deleting a pass also removes its uses and freezes for good, but not other passes (FR-19)', async () => {
    const { repo, db } = makeTestRepo()
    const target = await repo.createPass(membership({ monthlyEntries: 8 }))
    const other = await repo.createPass(multipass())
    const used = await repo.useEntry(target.id, today)
    const keptUse = await repo.useEntry(other.id, today)
    const freeze = await repo.addFreeze({
      passId: target.id,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
    })

    await repo.deletePass(target.id)

    expect(await repo.listUses(target.id)).toEqual([])
    expect(await db.uses.get((used as { use: { id: string } }).use.id)).toBeUndefined()
    expect(await db.freezes.get(freeze.id)).toBeUndefined()
    expect(await db.uses.where('passId').equals(target.id).count()).toBe(0)
    expect(await repo.listUses(other.id)).toHaveLength(1)
    expect(keptUse.ok).toBe(true)
    expect(await repo.getPass(other.id)).toBeDefined()
  })

  it('finds passes by gym through the gymRef.id index', async () => {
    const { repo, db } = makeTestRepo()
    await repo.createPass(multipass())
    await repo.createPass(multipass({ gymRef: { kind: 'user', id: 'gym-b' } }))
    expect(await db.passes.where('gymRef.id').equals('gym-b').toArray()).toHaveLength(1)
  })
})

describe('useEntry (−)', () => {
  it('records a use with a timestamp and nothing else (D3, D4, D26)', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    const result = await repo.useEntry(pass.id, today, at(today))
    expect(result.ok).toBe(true)
    const [use] = await repo.listUses(pass.id)
    expect(use).toMatchObject({ passId: pass.id, usedAt: at(today) })
    expect(Object.keys(use!).sort()).toEqual([
      'createdAt',
      'deletedAt',
      'id',
      'passId',
      'updatedAt',
      'usedAt',
    ])
  })

  it('stops at zero and writes nothing more (FR-11)', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ totalEntries: 2 }))
    expect((await repo.useEntry(pass.id, today)).ok).toBe(true)
    expect((await repo.useEntry(pass.id, today)).ok).toBe(true)
    expect(await repo.useEntry(pass.id, today)).toEqual({ ok: false, reason: 'none_left' })
    expect(await repo.listUses(pass.id)).toHaveLength(2)
  })

  it('a double tap on the last entry only counts once', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ totalEntries: 1 }))
    const results = await Promise.all([
      repo.useEntry(pass.id, today),
      repo.useEntry(pass.id, today),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(await repo.listUses(pass.id)).toHaveLength(1)
  })

  it('counts initialUsed, and works on the expiry day but not after it (FR-12)', async () => {
    const { repo } = makeTestRepo()
    const partly = await repo.createPass(multipass({ totalEntries: 3, initialUsed: 2 }))
    expect((await repo.useEntry(partly.id, today)).ok).toBe(true)
    expect(await repo.useEntry(partly.id, today)).toEqual({ ok: false, reason: 'none_left' })

    const ending = await repo.createPass(multipass({ expiryDate: '2026-10-15' }))
    expect((await repo.useEntry(ending.id, '2026-10-15')).ok).toBe(true)
    expect(await repo.useEntry(ending.id, '2026-10-16')).toEqual({ ok: false, reason: 'finished' })
  })

  it('an unlimited membership has no counter', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership())
    expect(await repo.useEntry(m.id, today)).toEqual({ ok: false, reason: 'no_counter' })
  })

  it('a monthly membership runs out, then comes back at the reset', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership({ monthlyEntries: 2 }))
    expect((await repo.useEntry(m.id, '2026-10-12', at('2026-10-12'))).ok).toBe(true)
    expect((await repo.useEntry(m.id, '2026-10-13', at('2026-10-13'))).ok).toBe(true)
    expect(await repo.useEntry(m.id, '2026-10-14', at('2026-10-14'))).toEqual({
      ok: false,
      reason: 'none_left',
    })
    expect((await repo.useEntry(m.id, '2026-11-10', at('2026-11-10'))).ok).toBe(true) // new period
  })

  it('needs an existing pass', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.useEntry('missing', today)).rejects.toBeInstanceOf(NotFoundError)
    const pass = await repo.createPass(multipass())
    await repo.deletePass(pass.id)
    await expect(repo.useEntry(pass.id, today)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('giveBackEntry (+)', () => {
  it('undoes the latest tap, one at a time, back to full (FR-52)', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    await repo.useEntry(pass.id, today, at('2026-10-10'))
    const later = await repo.useEntry(pass.id, today, at('2026-10-12'))
    const first = await repo.giveBackEntry(pass.id, today)
    expect(first).toEqual({
      ok: true,
      action: 'remove_use',
      useId: (later as { use: { id: string } }).use.id,
    })
    expect((await repo.giveBackEntry(pass.id, today)).ok).toBe(true)
    expect(await repo.giveBackEntry(pass.id, today)).toEqual({ ok: false, reason: 'full' })
    expect(await repo.listUses(pass.id)).toEqual([])
  })

  it('with no recorded uses, lowers "already used" and bumps updatedAt', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ initialUsed: 2 }))
    expect(await repo.giveBackEntry(pass.id, today)).toEqual({
      ok: true,
      action: 'lower_initial_used',
    })
    const after = await repo.getPass(pass.id)
    expect(after).toMatchObject({ initialUsed: 1 })
    expect(after!.updatedAt > pass.updatedAt).toBe(true)
  })

  it('never goes above the total, and an expired row is inert', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ expiryDate: '2026-10-14' }))
    await repo.useEntry(pass.id, '2026-10-14')
    expect(await repo.giveBackEntry(pass.id, '2026-10-15')).toEqual({
      ok: false,
      reason: 'finished',
    })
    expect(await repo.listUses(pass.id)).toHaveLength(1)
  })

  it('a used-up single entry can be undone', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(single())
    await repo.useEntry(pass.id, today)
    expect(await repo.useEntry(pass.id, today)).toEqual({ ok: false, reason: 'none_left' })
    expect((await repo.giveBackEntry(pass.id, today)).ok).toBe(true)
    expect((await repo.useEntry(pass.id, today)).ok).toBe(true)
  })

  it('a monthly membership only gives back this period’s uses', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership({ monthlyEntries: 8 }))
    await repo.useEntry(m.id, '2026-10-12', at('2026-10-12'))
    expect(await repo.giveBackEntry(m.id, '2026-11-15')).toEqual({ ok: false, reason: 'full' }) // last month's use
    expect((await repo.giveBackEntry(m.id, '2026-10-20')).ok).toBe(true)
  })

  it('an unlimited membership has nothing to give back', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership())
    expect(await repo.giveBackEntry(m.id, today)).toEqual({ ok: false, reason: 'no_counter' })
  })
})

describe('freezes', () => {
  it('adds, edits and deletes freezes on memberships only', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership())
    const freeze = await repo.addFreeze({
      passId: m.id,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
    })
    expect(
      (await repo.updateFreeze(freeze.id, { startDate: '2026-10-20', endDate: '2026-10-30' }))
        .endDate,
    ).toBe('2026-10-30')
    await expect(
      repo.updateFreeze(freeze.id, { startDate: '2026-10-20', endDate: '2026-10-01' }),
    ).rejects.toBeInstanceOf(ZodError)
    await repo.deleteFreeze(freeze.id)
    expect((await repo.listBundles())[0]?.freezes).toEqual([])
    const counted = await repo.createPass(multipass())
    await expect(
      repo.addFreeze({ passId: counted.id, startDate: '2026-10-20', endDate: '2026-10-22' }),
    ).rejects.toThrow('Only memberships')
  })
})

describe('listBundles', () => {
  it('groups live uses and freezes under their pass and skips deleted rows', async () => {
    const { repo, db } = makeTestRepo()
    const a = await repo.createPass(multipass())
    const b = await repo.createPass(membership())
    const gone = await repo.createPass(multipass())
    await repo.useEntry(a.id, today)
    await repo.useEntry(a.id, today)
    await repo.useEntry(gone.id, today)
    const [first] = await repo.listUses(a.id)
    await db.uses.put({ ...first!, deletedAt: '2026-10-02T00:00:00.000Z' })
    const f = await repo.addFreeze({ passId: b.id, startDate: '2026-10-20', endDate: '2026-10-22' })
    await repo.deletePass(gone.id)

    const bundles = await repo.listBundles()
    expect(bundles.map((x) => x.pass.id).sort()).toEqual([a.id, b.id].sort())
    expect(bundles.find((x) => x.pass.id === a.id)?.uses).toHaveLength(1)
    expect(bundles.find((x) => x.pass.id === b.id)?.freezes).toEqual([f])
  })

  it('feeds the domain logic: entries left reflect taps', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ totalEntries: 3 }))
    await repo.useEntry(pass.id, today)
    await repo.useEntry(pass.id, today)
    const [b] = await repo.listBundles()
    expect(getPassStatus(b!.pass, b!.uses, b!.freezes, today, DEFAULT_SETTINGS)).toMatchObject({
      state: 'active',
      entriesLeft: 1,
      low: true,
    })
    expect(makeUse(pass.id).passId).toBe(pass.id) // the factory builds rows the same shape
  })
})

describe('gyms', () => {
  it('lists built-in and user gyms together, sorted by name', async () => {
    const { repo } = makeTestRepo()
    await repo.findOrCreateGym('Alpha Wall')
    expect((await repo.listGyms()).map((g) => g.name)).toEqual([
      'Alpha Wall',
      'Boulder+',
      'Fit Bloc',
    ])
  })

  it('creates a gym for a name that matches none, tidying the text (D24, FR-25)', async () => {
    const { repo } = makeTestRepo()
    const result = await repo.findOrCreateGym('  Zig   Zag Wall ')
    expect(result).toEqual({ ref: { kind: 'user', id: 'id-1' }, created: true })
    expect(await repo.listUserGyms()).toMatchObject([{ id: 'id-1', name: 'Zig Zag Wall' }])
  })

  it('reuses an existing gym, ignoring case and punctuation, instead of creating a duplicate', async () => {
    const { repo } = makeTestRepo()
    expect(await repo.findOrCreateGym('fit  BLOC')).toEqual({ ref: gymRef, created: false })
    expect(await repo.findOrCreateGym('boulder plus')).toEqual({
      ref: { kind: 'builtin', id: 'b-plus' },
      created: false,
    })
    const first = await repo.findOrCreateGym('My Wall')
    const second = await repo.findOrCreateGym('my wall')
    expect(second).toEqual({ ref: first.ref, created: false })
    expect(await repo.listUserGyms()).toHaveLength(1)
  })

  it('two quick submits of the same new name make one gym', async () => {
    const { repo } = makeTestRepo()
    const [a, b] = await Promise.all([
      repo.findOrCreateGym('Brand New Gym'),
      repo.findOrCreateGym('Brand New Gym'),
    ])
    expect(a.ref).toEqual(b.ref)
    expect(await repo.listUserGyms()).toHaveLength(1)
  })

  it('saves a row: the gym and the pass together, reusing a gym that exists', async () => {
    const { repo } = makeTestRepo()
    const { gymRef: _gym, ...fields } = multipass()
    void _gym
    const first = await repo.createPassForGymText('  New   Wall ', fields)
    const second = await repo.createPassForGymText('new wall', fields)
    const third = await repo.createPassForGymText('fit bloc', fields)
    expect(first.gymRef).toEqual(second.gymRef)
    expect(third.gymRef).toEqual(gymRef)
    expect(await repo.listUserGyms()).toMatchObject([{ name: 'New Wall' }])
    expect(await repo.listPasses()).toHaveLength(3)
  })

  it('a row with an invalid pass saves nothing, not even its new gym', async () => {
    const { repo } = makeTestRepo()
    const { gymRef: _gym, ...fields } = multipass({ totalEntries: 0 })
    void _gym
    await expect(repo.createPassForGymText('Stray Gym', fields)).rejects.toBeInstanceOf(ZodError)
    expect(await repo.listUserGyms()).toEqual([])
    expect(await repo.listPasses()).toEqual([])
  })

  it('a partial name is a new gym, not a match', async () => {
    const { repo } = makeTestRepo()
    expect((await repo.findOrCreateGym('Fit')).created).toBe(true)
  })

  it('rejects empty, symbol-only and over-long names', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.findOrCreateGym('')).rejects.toBeInstanceOf(ZodError)
    await expect(repo.findOrCreateGym('  ?!  ')).rejects.toBeInstanceOf(ZodError)
    await expect(repo.findOrCreateGym('x'.repeat(101))).rejects.toBeInstanceOf(ZodError)
    expect(await repo.listUserGyms()).toEqual([])
  })
})

describe('settings', () => {
  it('returns defaults until changed, then merges changes', async () => {
    const { repo } = makeTestRepo()
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
    const next = await repo.updateSettings({ lowEntriesThreshold: 4, resetRemindersEnabled: false })
    expect(next).toEqual({
      ...DEFAULT_SETTINGS,
      lowEntriesThreshold: 4,
      resetRemindersEnabled: false,
    })
    expect(await repo.getSettings()).toEqual(next)
  })

  it('never fails on a damaged saved row: each bad field falls back to its default', async () => {
    const { repo, db } = makeTestRepo()
    const damaged = [
      { dismissedReminders: [] },
      { dismissedReminders: { 'p:low': 'two' } },
      { expiryReminderDays: 'soon', lowEntriesThreshold: null },
      { expiryReminderDays: [1, 2, 3, 4, 5, 6] },
      { lowRemindersEnabled: 'yes', resetRemindersEnabled: 0 },
      { expiryRemindersEnabled: undefined },
    ]
    for (const bad of damaged) {
      await db.settings.put({ id: 'settings', updatedAt: 'x', ...bad } as never)
      expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('keeps the good fields of a row that has a bad one', async () => {
    const { repo, db } = makeTestRepo()
    await db.settings.put({
      id: 'settings',
      updatedAt: 'x',
      lowEntriesThreshold: 5,
      lowRemindersEnabled: false,
      expiryReminderDays: 'soon',
      dismissedReminders: { 'p:low': 2 },
    } as never)
    expect(await repo.getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      lowEntriesThreshold: 5,
      lowRemindersEnabled: false,
      dismissedReminders: { 'p:low': 2 },
    })
  })

  it('a change can still be saved over a damaged row, and repairs it', async () => {
    const { repo, db } = makeTestRepo()
    await db.settings.put({ id: 'settings', updatedAt: 'x', dismissedReminders: [] } as never)
    const next = await repo.updateSettings({ lowRemindersEnabled: false })
    expect(next).toEqual({ ...DEFAULT_SETTINGS, lowRemindersEnabled: false })
    expect(await repo.getSettings()).toEqual(next)
  })

  it('fills in settings added later when reading an older saved row', async () => {
    const { repo, db } = makeTestRepo()
    await db.settings.put({ id: 'settings', updatedAt: 'x', lowEntriesThreshold: 5 } as never)
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, lowEntriesThreshold: 5 })
  })

  it('rejects invalid values and keeps the old ones', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.updateSettings({ lowEntriesThreshold: -1 })).rejects.toBeInstanceOf(ZodError)
    await expect(repo.updateSettings({ expiryReminderDays: [0] })).rejects.toBeInstanceOf(ZodError)
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('remembers dismissed reminders alongside other dismissals', async () => {
    const { repo } = makeTestRepo()
    await repo.dismissReminder('p1:expiring', 14)
    const settings = await repo.dismissReminder('p2:reset', 20261110)
    expect(settings.dismissedReminders).toEqual({ 'p1:expiring': 14, 'p2:reset': 20261110 })
  })

  it('dismisses several reminders in one write, keeping earlier ones', async () => {
    const { repo } = makeTestRepo()
    await repo.dismissReminder('p0:low', 2)
    const settings = await repo.dismissReminders([
      { key: 'p1:expiring', value: 3 },
      { key: 'p1:low', value: 1 },
    ])
    expect(settings.dismissedReminders).toEqual({ 'p0:low': 2, 'p1:expiring': 3, 'p1:low': 1 })
    expect(await repo.dismissReminders([])).toEqual(settings)
  })

  it('two dismissals at the same moment both stick', async () => {
    const { repo } = makeTestRepo()
    await Promise.all([
      repo.dismissReminders([{ key: 'a:low', value: 2 }]),
      repo.dismissReminders([{ key: 'b:low', value: 1 }]),
    ])
    expect((await repo.getSettings()).dismissedReminders).toEqual({ 'a:low': 2, 'b:low': 1 })
  })
})

describe('meta, wipe and persistence', () => {
  it('stores and reads meta values', async () => {
    const { repo } = makeTestRepo()
    expect(await repo.getMeta('lastSyncedAt')).toBeUndefined()
    await repo.setMeta('lastSyncedAt', '2026-10-01T00:00:00.000Z')
    expect(await repo.getMeta('lastSyncedAt')).toBe('2026-10-01T00:00:00.000Z')
  })

  it('clearAllData hard-deletes everything from every table', async () => {
    const { repo, db } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    await repo.useEntry(pass.id, today)
    await repo.findOrCreateGym('My Wall')
    await repo.updateSettings({ lowEntriesThreshold: 4 })
    await repo.setMeta('k', 'v')

    await repo.clearAllData()

    for (const table of db.tables) expect(await table.count()).toBe(0)
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps data when the database is closed and reopened', async () => {
    const { db, repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    db.close()
    const reopened = createRepo(new ClimbDB(db.name))
    expect(await reopened.getPass(pass.id)).toEqual(pass)
  })

  it('generates unique ids by default', async () => {
    const repo = createRepo(new ClimbDB('default-ids'))
    const a = await repo.createPass(multipass())
    const b = await repo.createPass(multipass())
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('saving an edited row', () => {
  const fieldsOf = (input: PassInput) => {
    const { gymRef: _gym, ...fields } = input
    void _gym
    return fields as Parameters<ReturnType<typeof makeTestRepo>['repo']['saveRow']>[2]
  }

  it('changes the fields and the gym together, keeping the id and the creation time', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    const saved = await repo.saveRow(
      created.id,
      '  Brand   New Gym ',
      fieldsOf(multipass({ totalEntries: 20, priceCents: 9900, comments: 'sale' })),
      { usedThisMonth: null, today },
    )
    expect(saved).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      totalEntries: 20,
      priceCents: 9900,
      comments: 'sale',
    })
    expect(saved.updatedAt > created.updatedAt).toBe(true)
    expect((await repo.listUserGyms()).map((g) => g.name)).toEqual(['Brand New Gym'])
    expect(saved.gymRef).toEqual({ kind: 'user', id: (await repo.listUserGyms())[0]!.id })
  })

  it('reuses an existing gym instead of making a copy', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass({ gymRef: { kind: 'builtin', id: 'b-plus' } }))
    const saved = await repo.saveRow(created.id, 'fit  bloc', fieldsOf(multipass()), {
      usedThisMonth: null,
      today,
    })
    expect(saved.gymRef).toEqual(gymRef)
    expect(await repo.listUserGyms()).toEqual([])
  })

  it('an invalid edit changes nothing, not even the gym', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    await expect(
      repo.saveRow(created.id, 'Stray Gym', fieldsOf(multipass({ totalEntries: 0 })), {
        usedThisMonth: null,
        today,
      }),
    ).rejects.toBeInstanceOf(ZodError)
    expect(await repo.getPass(created.id)).toEqual(created)
    expect(await repo.listUserGyms()).toEqual([])
  })

  it('editing a deleted row fails and leaves no stray gym', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    await repo.deletePass(created.id)
    await expect(
      repo.saveRow(created.id, 'Stray Gym', fieldsOf(multipass()), { usedThisMonth: null, today }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await repo.listUserGyms()).toEqual([])
  })

  it('moving the expiry of a used-up or expired pass later brings it back (D8, D27)', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass({ expiryDate: '2026-10-01' }))
    const status = async () => {
      const [b] = await repo.listBundles()
      return getPassStatus(b!.pass, b!.uses, b!.freezes, today, DEFAULT_SETTINGS)
    }
    expect((await status()).state).toBe('expired')
    await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(multipass({ expiryDate: '2027-03-01' })), {
      usedThisMonth: null,
      today,
    })
    expect((await status()).isActive).toBe(true)
  })

  describe('entries used this month', () => {
    const monthly = (overrides: Record<string, unknown> = {}) =>
      membership({ monthlyEntries: 8, purchaseDate: '2026-10-01', ...overrides })

    const usedNow = async (repo: ReturnType<typeof makeTestRepo>['repo']) => {
      const [b] = await repo.listBundles()
      return getPassStatus(b!.pass, b!.uses, b!.freezes, today, DEFAULT_SETTINGS).entriesLeft
    }

    it('raises and lowers this period’s count, leaving other periods alone', async () => {
      const { repo } = makeTestRepo()
      const created = await repo.createPass(monthly())
      await repo.useEntry(created.id, today, at('2026-10-05')) // a real tap this month
      await repo.useEntry(created.id, today, at('2026-09-20')) // last period: ignored
      expect(await usedNow(repo)).toBe(7)

      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(monthly()), { usedThisMonth: 5, today })
      expect(await usedNow(repo)).toBe(3)

      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(monthly()), { usedThisMonth: 1, today })
      expect(await usedNow(repo)).toBe(7)

      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(monthly()), { usedThisMonth: 0, today })
      expect(await usedNow(repo)).toBe(8)
      const kept = await repo.listUses(created.id)
      expect(kept.map((u) => u.usedAt)).toEqual([at('2026-09-20')])
    })

    it('null leaves the count alone', async () => {
      const { repo } = makeTestRepo()
      const created = await repo.createPass(monthly())
      await repo.useEntry(created.id, today, at('2026-10-05'))
      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(monthly()), {
        usedThisMonth: null,
        today,
      })
      expect(await usedNow(repo)).toBe(7)
    })

    it('refuses more than the allowance, and changes nothing', async () => {
      const { repo } = makeTestRepo()
      const created = await repo.createPass(monthly())
      await expect(
        repo.saveRow(created.id, 'Stray Gym', fieldsOf(monthly()), { usedThisMonth: 9, today }),
      ).rejects.toThrow('Used this month')
      expect(await repo.listUserGyms()).toEqual([])
    })

    it('changing the reset day recalculates the count straight away (FR-58)', async () => {
      const { repo } = makeTestRepo()
      const created = await repo.createPass(monthly({ resetDay: 1 }))
      await repo.useEntry(created.id, today, at('2026-10-05'))
      expect(await usedNow(repo)).toBe(7)
      // Reset on the 10th: today (15th) is in the period that began on the 10th, so the use on the 5th no longer counts.
      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(monthly({ resetDay: 10 })), {
        usedThisMonth: null,
        today,
      })
      expect(await usedNow(repo)).toBe(8)
    })

    it('is ignored for a pass that is not a monthly membership', async () => {
      const { repo } = makeTestRepo()
      const created = await repo.createPass(multipass())
      await repo.saveRow(created.id, 'Fit Bloc', fieldsOf(multipass()), { usedThisMonth: 3, today })
      expect(await repo.listUses(created.id)).toEqual([])
    })
  })
})

describe('backup and import', () => {
  async function populate(repo: ReturnType<typeof makeTestRepo>['repo']) {
    const own = await repo.findOrCreateGym('Zig Zag Wall')
    const pack = await repo.createPass(
      multipass({ gymRef: own.ref, priceCents: 9900, comments: 'sale' }),
    )
    const monthly = await repo.createPass(membership({ monthlyEntries: 8, resetDay: 20 }))
    const gone = await repo.createPass(multipass({ totalEntries: 3 }))
    await repo.useEntry(pack.id, today)
    await repo.useEntry(pack.id, today)
    await repo.useEntry(monthly.id, today)
    await repo.giveBackEntry(pack.id, today) // a deleted use
    await repo.addFreeze({ passId: monthly.id, startDate: '2026-11-01', endDate: '2026-11-05' })
    await repo.deletePass(gone.id)
    await repo.updateSettings({ lowEntriesThreshold: 5, expiryReminderDays: [30, 7] })
    return { pack, monthly, gone }
  }

  const fileFrom = async (repo: ReturnType<typeof makeTestRepo>['repo']) => {
    const parsed = parseBackup(backupToText(await repo.exportBackup()))
    if (!parsed.ok) throw new Error(parsed.error)
    return parsed.backup
  }

  it('a snapshot has every row, removed uses too, and settings only once they were saved', async () => {
    const { repo } = makeTestRepo()
    expect((await repo.readSnapshot()).settings).toBeUndefined()
    const { gone } = await populate(repo)
    const snap = await repo.readSnapshot()
    expect(snap.passes).toHaveLength(2)
    expect(snap.passes.find((p) => p.id === gone.id)).toBeUndefined()
    expect(snap.uses.some((u) => u.deletedAt !== null)).toBe(true)
    expect(snap.freezes).toHaveLength(1)
    expect(snap.userGyms).toHaveLength(1)
    expect(snap.settings).toMatchObject({ lowEntriesThreshold: 5, expiryReminderDays: [30, 7] })
    expect(typeof snap.settings?.updatedAt).toBe('string')
  })

  it('moves everything to an empty device exactly: the same rows, deletions and settings', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await populate(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    const summary = await b.repo.importBackup(await fileFrom(a.repo))
    expect(summary).toMatchObject({
      passesAdded: 2,
      gymsAdded: 1,
      settings: 'added',
      nothingNew: false,
    })

    const sortById = <T extends { id: string }>(rows: T[]) =>
      [...rows].sort((x, y) => (x.id < y.id ? -1 : 1))
    const [from, to] = [await a.repo.readSnapshot(), await b.repo.readSnapshot()]
    expect(sortById(to.passes)).toEqual(sortById(from.passes))
    expect(sortById(to.uses)).toEqual(sortById(from.uses))
    expect(sortById(to.freezes)).toEqual(sortById(from.freezes))
    expect(sortById(to.userGyms)).toEqual(sortById(from.userGyms))
    expect(to.settings).toEqual(from.settings)
    // and the screens' view of it
    expect((await b.repo.listBundles()).map((x) => x.pass.id).sort()).toEqual(
      (await a.repo.listBundles()).map((x) => x.pass.id).sort(),
    )
  })

  it('adds to a device that has its own passes, keeping them', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await populate(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    const mine = await b.repo.createPass(multipass({ totalEntries: 7 }))
    await b.repo.importBackup(await fileFrom(a.repo))
    const ids = (await b.repo.listPasses()).map((p) => p.id)
    expect(ids).toContain(mine.id)
    expect(ids).toHaveLength(3) // mine, and the two live ones from the file
  })

  it('the same file twice changes nothing the second time', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await populate(a.repo)
    const file = await fileFrom(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    await b.repo.importBackup(file)
    const before = await b.repo.readSnapshot()
    expect((await b.repo.previewImport(file)).nothingNew).toBe(true)
    const again = await b.repo.importBackup(file)
    expect(again.nothingNew).toBe(true)
    expect(await b.repo.readSnapshot()).toEqual(before)
  })

  it('two devices used in turn: each adds what the other did, and the newer edit of a pass wins', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    const { pack } = await populate(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    await b.repo.importBackup(await fileFrom(a.repo))
    // On A: another tap. On B (later): the pass is edited.
    await a.repo.useEntry(pack.id, today, at('2026-10-20'))
    const bPass = await b.repo.getPass(pack.id)
    await b.repo.updatePass(pack.id, {
      ...(bPass as PassInput),
      comments: 'edited on B',
    } as PassInput)

    await a.repo.importBackup(await fileFrom(b.repo))
    await b.repo.importBackup(await fileFrom(a.repo))
    const [onA, onB] = [await a.repo.readSnapshot(), await b.repo.readSnapshot()]
    expect(onA.passes.find((p) => p.id === pack.id)?.comments).toBe('edited on B')
    expect(onB.passes.find((p) => p.id === pack.id)?.comments).toBe('edited on B')
    expect(onA.uses.length).toBe(onB.uses.length)
    expect(onA.uses.filter((u) => u.deletedAt === null)).toHaveLength(
      onB.uses.filter((u) => u.deletedAt === null).length,
    )
  })

  it('a pass deleted on one device stays on the other after the import (deletions are not carried)', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    const { pack } = await populate(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    await b.repo.importBackup(await fileFrom(a.repo))
    await b.repo.deletePass(pack.id)
    await a.repo.importBackup(await fileFrom(b.repo))
    expect(await a.repo.getPass(pack.id)).toBeDefined()
  })

  it('a retired built-in gym is listed as inactive and reused when its name is typed', async () => {
    const repo = createRepo(new ClimbDB('retired-gym-test'), {
      builtinGyms: [
        { id: 'b-old', name: 'Old Wall', isActive: false },
        { id: 'b-new', name: 'New Wall', isActive: true },
      ],
    })
    const listed = await repo.listGyms()
    expect(listed.map((g) => [g.name, g.isActive])).toEqual([
      ['New Wall', true],
      ['Old Wall', false],
    ])
    expect(await repo.findOrCreateGym('old wall')).toEqual({
      ref: { kind: 'builtin', id: 'b-old' },
      created: false,
    })
    expect(await repo.listUserGyms()).toEqual([])
  })

  it('a gym with the same name is the same gym: no second copy, and the pass points at the one here', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    const theirGym = await a.repo.findOrCreateGym('fit  bloc club')
    await a.repo.createPass(multipass({ gymRef: theirGym.ref }))
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    const myGym = await b.repo.findOrCreateGym('Fit Bloc Club')
    const summary = await b.repo.importBackup(await fileFrom(a.repo))
    expect(summary).toMatchObject({ gymsAdded: 0, gymsMerged: 1 })
    expect(await b.repo.listUserGyms()).toHaveLength(1)
    expect((await b.repo.listPasses())[0]?.gymRef).toEqual(myGym.ref)
  })

  it('previewing writes nothing', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await populate(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    const summary = await b.repo.previewImport(await fileFrom(a.repo))
    expect(summary.passesAdded).toBe(2)
    expect((await b.repo.readSnapshot()).passes).toEqual([])
  })

  it('is all or nothing: if a write fails part-way, nothing at all is changed', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await populate(a.repo)
    const file = await fileFrom(a.repo)
    // A value IndexedDB cannot store, in the last table written, after gyms and passes were written.
    const broken = {
      ...file,
      freezes: [{ ...file.freezes[0]!, startDate: () => 'x' }],
    } as unknown as Backup
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    await expect(b.repo.importBackup(broken)).rejects.toThrow()
    const after = await b.repo.readSnapshot()
    expect(after.userGyms).toEqual([])
    expect(after.passes).toEqual([])
    expect(after.uses).toEqual([])
    expect(after.settings).toBeUndefined()
  })

  it('an import does not touch this device’s settings unless the file’s are newer and different', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await a.repo.updateSettings({ lowEntriesThreshold: 9 })
    const file = await fileFrom(a.repo)
    const b = makeTestRepo({ idPrefix: 'b', startSecond: 100 })
    await b.repo.updateSettings({ lowEntriesThreshold: 3 }) // saved after the file was made
    expect((await b.repo.importBackup(file)).settings).toBe('kept')
    expect((await b.repo.getSettings()).lowEntriesThreshold).toBe(3)
  })
})

describe('the backup reminder state (D47)', () => {
  it('starts with no backup and no snooze', async () => {
    const { repo } = makeTestRepo()
    expect(await repo.getBackupState()).toEqual({ lastBackupAt: null, snoozedUntil: null })
  })

  it('remembers when a backup was made, and a snooze', async () => {
    const { repo } = makeTestRepo({ now: () => '2026-10-05T08:00:00.000Z' })
    await repo.markBackedUp()
    await repo.snoozeBackupNudge('2026-10-12')
    expect(await repo.getBackupState()).toEqual({
      lastBackupAt: '2026-10-05T08:00:00.000Z',
      snoozedUntil: '2026-10-12',
    })
  })

  it('a new backup clears the snooze', async () => {
    const { repo } = makeTestRepo()
    await repo.snoozeBackupNudge('2026-10-12')
    await repo.markBackedUp()
    expect((await repo.getBackupState()).snoozedUntil).toBeNull()
  })

  it('ignores stored values that are not text', async () => {
    const { repo } = makeTestRepo()
    await repo.setMeta('lastBackupAt', 12345)
    await repo.setMeta('backupNudgeSnoozedUntil', { not: 'a date' })
    expect(await repo.getBackupState()).toEqual({ lastBackupAt: null, snoozedUntil: null })
  })

  it('opening a backup file counts as backed up: the passes are in that file', async () => {
    const a = makeTestRepo({ idPrefix: 'a' })
    await a.repo.createPass(multipass())
    const file = await a.repo.exportBackup()
    const b = makeTestRepo({ idPrefix: 'b', now: () => '2026-10-06T08:00:00.000Z' })
    await b.repo.importBackup(file)
    expect((await b.repo.getBackupState()).lastBackupAt).toBe('2026-10-06T08:00:00.000Z')
  })

  it('a refused import does not count', async () => {
    const { repo } = makeTestRepo()
    const bad = { passes: [{ id: 'x', gymRef: () => 1 }] } as unknown as Backup
    await expect(repo.importBackup(bad)).rejects.toBeDefined()
    expect((await repo.getBackupState()).lastBackupAt).toBeNull()
  })

  it('deleting all data forgets it', async () => {
    const { repo } = makeTestRepo()
    await repo.markBackedUp()
    await repo.clearAllData()
    expect((await repo.getBackupState()).lastBackupAt).toBeNull()
  })
})
