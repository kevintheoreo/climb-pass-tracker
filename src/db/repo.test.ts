import { ZodError } from 'zod'
import { DEFAULT_SETTINGS } from '../domain/settings'
import { getPassStatus } from '../domain/passStatus'
import type { PassInput } from '../domain/types'
import { ClimbDB } from './db'
import { createRepo, GymInUseError, NotFoundError } from './repo'
import { makeTestRepo } from './testRepo'

const gymRef = { kind: 'builtin', id: 'gym-a' } as const

const multipass = (
  overrides: Partial<Extract<PassInput, { totalEntries: number }>> = {},
): PassInput => ({
  gymRef,
  passType: 'multipass',
  name: '10-Pass',
  priceCents: 12000,
  notes: null,
  totalEntries: 10,
  initialUsed: 0,
  purchaseDate: '2026-01-01',
  expiryDate: '2026-12-31',
  ...overrides,
})

const membership = (): PassInput => ({
  gymRef,
  passType: 'membership',
  name: 'Monthly',
  priceCents: null,
  notes: null,
  billingPeriod: 'monthly',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
})

const useInput = (passId: string, usedAt = '2026-06-01T04:00:00.000Z') => ({
  passId,
  usedAt,
  note: null,
})

describe('passes', () => {
  it('creates a pass with id and timestamps and reads it back', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    expect(pass).toMatchObject({ id: 'id-1', deletedAt: null, name: '10-Pass' })
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

  it('updates fields, keeps createdAt and bumps updatedAt', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    const updated = await repo.updatePass(
      created.id,
      multipass({ expiryDate: '2027-03-31', name: 'Extended' }),
    )
    expect(updated).toMatchObject({ id: created.id, name: 'Extended', expiryDate: '2027-03-31' })
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt > created.updatedAt).toBe(true)
    expect(await repo.getPass(created.id)).toEqual(updated)
  })

  it('refuses to change a pass type, validates updates, and rejects unknown passes', async () => {
    const { repo } = makeTestRepo()
    const created = await repo.createPass(multipass())
    await expect(repo.updatePass(created.id, membership())).rejects.toThrow('cannot change type')
    await expect(
      repo.updatePass(created.id, multipass({ totalEntries: 0 })),
    ).rejects.toBeInstanceOf(ZodError)
    await expect(repo.updatePass('nope', multipass())).rejects.toBeInstanceOf(NotFoundError)
    expect(await repo.getPass(created.id)).toEqual(created)
  })

  it('soft-deletes: hidden from reads but kept in the table with deletedAt set', async () => {
    const { repo, db } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    await repo.deletePass(pass.id)
    expect(await repo.getPass(pass.id)).toBeUndefined()
    expect(await repo.listPasses()).toEqual([])
    const raw = await db.passes.get(pass.id)
    expect(raw?.deletedAt).not.toBeNull()
    expect(raw?.updatedAt).toBe(raw?.deletedAt)
    await expect(repo.deletePass(pass.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deleting a pass also soft-deletes its uses and freezes, but not other passes (FR-19)', async () => {
    const { repo, db } = makeTestRepo()
    const target = await repo.createPass(membership())
    const other = await repo.createPass(multipass())
    const use = await repo.addUse(useInput(target.id))
    const keptUse = await repo.addUse(useInput(other.id))
    const earlierDeleted = await repo.addUse(useInput(target.id))
    await repo.deleteUse(earlierDeleted.id)
    const earlierDeletedAt = (await db.uses.get(earlierDeleted.id))?.deletedAt
    const freeze = await repo.addFreeze({
      passId: target.id,
      startDate: '2026-10-10',
      endDate: '2026-10-12',
    })

    await repo.deletePass(target.id)

    expect(await repo.listUses(target.id)).toEqual([])
    expect((await db.uses.get(use.id))?.deletedAt).not.toBeNull()
    expect((await db.freezes.get(freeze.id))?.deletedAt).not.toBeNull()
    // A use deleted earlier keeps its original deletion time.
    expect((await db.uses.get(earlierDeleted.id))?.deletedAt).toBe(earlierDeletedAt)
    // Unrelated data is untouched.
    expect(await repo.listUses(other.id)).toEqual([keptUse])
    expect(await repo.getPass(other.id)).toBeDefined()
  })

  it('finds passes by gym through the gymRef.id index', async () => {
    const { repo, db } = makeTestRepo()
    await repo.createPass(multipass())
    await repo.createPass(multipass({ gymRef: { kind: 'user', id: 'gym-b' } }))
    const found = await db.passes.where('gymRef.id').equals('gym-b').toArray()
    expect(found).toHaveLength(1)
  })
})

describe('uses', () => {
  it('adds, edits, lists and deletes uses', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    const use = await repo.addUse({ ...useInput(pass.id), note: 'with friends' })
    expect(await repo.listUses(pass.id)).toEqual([use])

    const moved = await repo.updateUse(use.id, { usedAt: '2026-05-31T04:00:00.000Z', note: null })
    expect(moved).toMatchObject({ usedAt: '2026-05-31T04:00:00.000Z', note: null, passId: pass.id })
    expect(moved.updatedAt > use.updatedAt).toBe(true)

    await repo.deleteUse(use.id)
    expect(await repo.listUses(pass.id)).toEqual([])
    await expect(repo.deleteUse(use.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('needs an existing, undeleted pass and a valid timestamp', async () => {
    const { repo } = makeTestRepo()
    await expect(repo.addUse(useInput('missing'))).rejects.toBeInstanceOf(NotFoundError)
    const pass = await repo.createPass(multipass())
    await expect(repo.addUse({ ...useInput(pass.id), usedAt: 'yesterday' })).rejects.toBeInstanceOf(
      ZodError,
    )
    await repo.deletePass(pass.id)
    await expect(repo.addUse(useInput(pass.id))).rejects.toBeInstanceOf(NotFoundError)
  })

  it('does not store anything about who used the entry (D4)', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass())
    const use = await repo.addUse({ ...useInput(pass.id), name: 'Alex' } as never)
    expect(Object.keys(use).sort()).toEqual([
      'createdAt',
      'deletedAt',
      'id',
      'note',
      'passId',
      'updatedAt',
      'usedAt',
    ])
  })
})

describe('freezes', () => {
  it('adds, edits and deletes freezes on memberships only', async () => {
    const { repo } = makeTestRepo()
    const m = await repo.createPass(membership())
    const freeze = await repo.addFreeze({
      passId: m.id,
      startDate: '2026-10-10',
      endDate: '2026-10-12',
    })
    const edited = await repo.updateFreeze(freeze.id, {
      startDate: '2026-10-10',
      endDate: '2026-10-20',
    })
    expect(edited.endDate).toBe('2026-10-20')
    await expect(
      repo.updateFreeze(freeze.id, { startDate: '2026-10-10', endDate: '2026-10-01' }),
    ).rejects.toBeInstanceOf(ZodError)
    await repo.deleteFreeze(freeze.id)
    expect((await repo.listBundles())[0]?.freezes).toEqual([])

    const counted = await repo.createPass(multipass())
    await expect(
      repo.addFreeze({ passId: counted.id, startDate: '2026-10-10', endDate: '2026-10-12' }),
    ).rejects.toThrow('Only memberships')
  })
})

describe('listBundles', () => {
  it('groups live uses and freezes under their pass and skips deleted rows', async () => {
    const { repo } = makeTestRepo()
    const a = await repo.createPass(multipass())
    const b = await repo.createPass(membership())
    const gone = await repo.createPass(multipass({ name: 'Gone' }))
    const u1 = await repo.addUse(useInput(a.id))
    const u2 = await repo.addUse(useInput(a.id))
    await repo.addUse(useInput(gone.id))
    await repo.deleteUse(u2.id)
    const f = await repo.addFreeze({ passId: b.id, startDate: '2026-10-10', endDate: '2026-10-12' })
    await repo.deletePass(gone.id)

    const bundles = await repo.listBundles()
    expect(bundles.map((x) => x.pass.id).sort()).toEqual([a.id, b.id].sort())
    expect(bundles.find((x) => x.pass.id === a.id)?.uses).toEqual([u1])
    expect(bundles.find((x) => x.pass.id === b.id)?.freezes).toEqual([f])
  })

  it('feeds the domain logic: entries left reflect logged uses', async () => {
    const { repo } = makeTestRepo()
    const pass = await repo.createPass(multipass({ totalEntries: 3 }))
    await repo.addUse(useInput(pass.id))
    await repo.addUse(useInput(pass.id))
    const [b] = await repo.listBundles()
    const status = getPassStatus(b!.pass, b!.uses, b!.freezes, '2026-10-01', DEFAULT_SETTINGS)
    expect(status).toMatchObject({ state: 'active', entriesLeft: 1, low: true })
  })
})

describe('user gyms and templates', () => {
  it('adds, edits and lists gyms; templates can hold price and validity (Q3)', async () => {
    const { repo } = makeTestRepo()
    const gym = await repo.addUserGym({ name: 'My Wall', website: null })
    expect(
      (await repo.updateUserGym(gym.id, { name: 'My Wall 2', website: 'https://example.com' }))
        .name,
    ).toBe('My Wall 2')
    const ref = { kind: 'user', id: gym.id } as const
    const tpl = await repo.addUserTemplate({
      gymRef: ref,
      passType: 'multipass',
      name: '5-Pass',
      totalEntries: 5,
      priceCents: 7500,
      validityMonths: 6,
      billingPeriod: null,
    })
    expect(await repo.listUserGyms()).toHaveLength(1)
    expect(await repo.listUserTemplates(ref)).toEqual([tpl])
    expect(await repo.listUserTemplates({ kind: 'builtin', id: gym.id })).toEqual([])
    await expect(repo.addUserGym({ name: '  ', website: null })).rejects.toBeInstanceOf(ZodError)
    await expect(
      repo.addUserTemplate({
        gymRef: ref,
        passType: 'multipass',
        name: 'x',
        totalEntries: null,
        priceCents: null,
        validityMonths: null,
        billingPeriod: null,
      }),
    ).rejects.toBeInstanceOf(ZodError)
  })

  it('gets a single gym or template, but not a deleted one', async () => {
    const { repo } = makeTestRepo()
    const gym = await repo.addUserGym({ name: 'My Wall', website: null })
    const ref = { kind: 'user', id: gym.id } as const
    const tpl = await repo.addUserTemplate({
      gymRef: ref,
      passType: 'single_entry',
      name: 'Day',
      totalEntries: null,
      priceCents: null,
      validityMonths: null,
      billingPeriod: null,
    })
    expect(await repo.getUserGym(gym.id)).toEqual(gym)
    expect(await repo.getUserTemplate(tpl.id)).toEqual(tpl)
    expect(await repo.getUserGym('nope')).toBeUndefined()
    await repo.deleteUserTemplate(tpl.id)
    await repo.deleteUserGym(gym.id)
    expect(await repo.getUserTemplate(tpl.id)).toBeUndefined()
    expect(await repo.getUserGym(gym.id)).toBeUndefined()
  })

  it('lets a user add a template to a built-in gym', async () => {
    const { repo } = makeTestRepo()
    await repo.addUserTemplate({
      gymRef,
      passType: 'membership',
      name: 'Student',
      totalEntries: null,
      priceCents: null,
      validityMonths: 12,
      billingPeriod: 'yearly',
    })
    expect(await repo.listUserTemplates(gymRef)).toHaveLength(1)
  })

  it('deletes a gym and its templates, but refuses while it still has passes', async () => {
    const { repo, db } = makeTestRepo()
    const gym = await repo.addUserGym({ name: 'My Wall', website: null })
    const ref = { kind: 'user', id: gym.id } as const
    const tpl = await repo.addUserTemplate({
      gymRef: ref,
      passType: 'single_entry',
      name: 'Day',
      totalEntries: null,
      priceCents: 2200,
      validityMonths: null,
      billingPeriod: null,
    })
    const pass = await repo.createPass(multipass({ gymRef: ref }))

    await expect(repo.deleteUserGym(gym.id)).rejects.toBeInstanceOf(GymInUseError)
    expect(await repo.listUserGyms()).toHaveLength(1)

    await repo.deletePass(pass.id) // a deleted pass no longer blocks
    await repo.deleteUserGym(gym.id)
    expect(await repo.listUserGyms()).toEqual([])
    expect(await repo.listUserTemplates(ref)).toEqual([])
    expect((await db.userTemplates.get(tpl.id))?.deletedAt).not.toBeNull()
  })
})

describe('hidden gyms', () => {
  it('hides, unhides and re-hides a built-in gym', async () => {
    const { repo, db } = makeTestRepo()
    await repo.hideGym('gym-a')
    await repo.hideGym('gym-a') // idempotent
    expect(await repo.listHiddenGymIds()).toEqual(['gym-a'])
    const first = await db.hiddenGyms.get('gym-a')

    await repo.unhideGym('gym-a')
    expect(await repo.listHiddenGymIds()).toEqual([])
    await repo.unhideGym('gym-a') // no-op

    await repo.hideGym('gym-a')
    expect(await repo.listHiddenGymIds()).toEqual(['gym-a'])
    expect((await db.hiddenGyms.get('gym-a'))?.createdAt).toBe(first?.createdAt)
  })
})

describe('settings', () => {
  it('returns defaults until changed, then merges changes', async () => {
    const { repo } = makeTestRepo()
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
    const next = await repo.updateSettings({ lowEntriesThreshold: 4 })
    expect(next).toEqual({ ...DEFAULT_SETTINGS, lowEntriesThreshold: 4 })
    expect(await repo.getSettings()).toEqual(next)
    await repo.updateSettings({ expiryRemindersEnabled: false })
    expect(await repo.getSettings()).toMatchObject({
      lowEntriesThreshold: 4,
      expiryRemindersEnabled: false,
    })
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
    const settings = await repo.dismissReminder('p2:low', 2)
    expect(settings.dismissedReminders).toEqual({ 'p1:expiring': 14, 'p2:low': 2 })
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
    await repo.addUse(useInput(pass.id))
    await repo.addUserGym({ name: 'My Wall', website: null })
    await repo.hideGym('gym-a')
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
    const db = new ClimbDB('default-ids')
    const repo = createRepo(db)
    const a = await repo.createPass(multipass())
    const b = await repo.createPass(multipass())
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
