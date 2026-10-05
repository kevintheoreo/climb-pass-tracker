import {
  backupFilename,
  backupToText,
  buildBackup,
  parseBackup,
  planImport,
  type Backup,
  type ImportPlan,
  type Snapshot,
  type StoredSettings,
} from './backup'
import type { BuiltinGym } from './gyms'
import { DEFAULT_SETTINGS } from './settings'
import {
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUse,
} from './testFactories'
import type { Freeze, RecordMeta, UserGym } from './types'

const BUILTIN: BuiltinGym[] = [{ id: 'b-boulder', name: 'Boulder+', isActive: true }]
const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-02-01T00:00:00.000Z'
const T2 = '2026-03-01T00:00:00.000Z'

const gym = (id: string, name: string, over: Partial<UserGym> = {}): UserGym => ({
  id,
  name,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...over,
})
const settings = (over: Partial<StoredSettings> = {}): StoredSettings => ({
  ...DEFAULT_SETTINGS,
  updatedAt: T1,
  ...over,
})
const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  userGyms: [],
  passes: [],
  uses: [],
  freezes: [],
  settings: undefined,
  ...over,
})
const backup = (over: Partial<Snapshot> = {}): Backup => buildBackup(snapshot(over), T2)

const replaceById = <T extends RecordMeta>(rows: T[], put: T[]) => {
  const map = new Map(rows.map((r) => [r.id, r]))
  for (const row of put) map.set(row.id, row)
  return [...map.values()]
}
/** What the device holds after the plan is written. */
function apply(local: Snapshot, plan: ImportPlan): Snapshot {
  return {
    userGyms: replaceById(local.userGyms, plan.put.userGyms),
    passes: replaceById(local.passes, plan.put.passes),
    uses: replaceById(local.uses, plan.put.uses),
    freezes: replaceById(local.freezes, plan.put.freezes),
    settings: plan.put.settings ?? local.settings,
  }
}

const full = (): Snapshot => {
  const g = gym('g1', 'Zig Zag Wall')
  const pack = makeCounted({
    id: 'p1',
    gymRef: { kind: 'user', id: 'g1' },
    priceCents: 12050,
    comments: 'sale',
  })
  const monthly = makeMonthly({ id: 'p2', monthlyEntries: 8, resetDay: 20 })
  const single = makeSingle({ id: 'p3', expiryDate: null })
  const unlimited = makeMembership({ id: 'p4' })
  return snapshot({
    userGyms: [g],
    passes: [pack, monthly, single, unlimited],
    uses: [makeUse('p1', { id: 'u1' }), makeUse('p2', { id: 'u2' })],
    freezes: [makeFreeze('p4', '2026-03-01', '2026-03-10')],
    settings: settings({ lowEntriesThreshold: 4, dismissedReminders: { 'p1:low': 2 } }),
  })
}

describe('writing a backup', () => {
  it('is named for the day', () => {
    expect(backupFilename('2026-10-04')).toBe('climb-pass-tracker-backup-2026-10-04.json')
  })

  it('round-trips every kind of row exactly', () => {
    const original = buildBackup(full(), T2)
    const parsed = parseBackup(backupToText(original))
    expect(parsed).toEqual({ ok: true, backup: original })
  })

  it('writes the same file for the same data, whatever order the rows came in', () => {
    const a = full()
    const b = { ...a, passes: [...a.passes].reverse(), uses: [...a.uses].reverse() }
    expect(backupToText(buildBackup(a, T2))).toBe(backupToText(buildBackup(b, T2)))
  })

  it('carries deleted rows too, so a deletion can travel', () => {
    const gone = makeCounted({ id: 'gone', deletedAt: T1, updatedAt: T1 })
    const parsed = parseBackup(backupToText(backup({ passes: [gone] })))
    expect(parsed.ok && parsed.backup.passes[0]!.deletedAt).toBe(T1)
  })

  it('an empty device makes a valid, empty backup', () => {
    const parsed = parseBackup(backupToText(backup()))
    expect(parsed.ok && parsed.backup).toMatchObject({ passes: [], settings: null })
  })
})

describe('reading a backup', () => {
  // These tests edit a valid file by hand to make it wrong, so the file is typed loosely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Loose = any
  const good = (): Loose => JSON.parse(backupToText(buildBackup(full(), T2)))
  const refuse = (value: unknown) => {
    const result = parseBackup(typeof value === 'string' ? value : JSON.stringify(value))
    expect(result.ok).toBe(false)
    return result.ok ? '' : result.error
  }

  it('refuses text that is not a backup, and says so', () => {
    for (const text of [
      '',
      'hello',
      '[]',
      'null',
      '{}',
      '{"format":"other","version":1}',
      '<html></html>',
    ]) {
      expect(refuse(text)).toMatch(/not a Climb Pass Tracker backup/)
    }
  })

  it('every refusal says nothing was imported', () => {
    expect(refuse('nonsense')).toMatch(/Nothing was imported/)
    expect(refuse({ ...good(), version: 99 })).toMatch(/Nothing was imported/)
    expect(refuse({ ...good(), passes: 'x' })).toMatch(/Nothing was imported/)
  })

  it('accepts a file that starts with a byte-order mark', () => {
    expect(parseBackup('﻿' + backupToText(backup())).ok).toBe(true)
  })

  it('refuses a backup from a newer version of the app, and says to update', () => {
    expect(refuse({ ...good(), version: 2 })).toMatch(/newer version of the app/)
  })

  it.each([0, -1, 1.5, '1', null])('refuses a version of %j', (version) => {
    expect(refuse({ ...good(), version })).toMatch(/not a Climb Pass Tracker backup/)
  })

  it('names the damaged pass', () => {
    const file = good()
    file.passes[1].monthlyEntries = 0
    expect(refuse(file)).toMatch(/pass 2: .*at least 1/i)
  })

  it('refuses wrong types and missing fields', () => {
    const wrongTime = good()
    wrongTime.uses[0].usedAt = 'yesterday'
    expect(refuse(wrongTime)).toMatch(/recorded use 1/)

    const missing = good()
    delete missing.freezes
    expect(refuse(missing)).toMatch(/damaged/)

    const badSettings = good()
    badSettings.settings.expiryReminderDays = [0]
    expect(refuse(badSettings)).toMatch(/settings/)
  })

  it('refuses rows that break the pass rules', () => {
    const tooMany = good()
    tooMany.passes[0].totalEntries = 5000
    expect(refuse(tooMany)).toMatch(/pass 1/)
    const pastExpiry = good()
    pastExpiry.passes[0].expiryDate = '2000-01-01'
    expect(refuse(pastExpiry)).toMatch(/pass 1: Expiry date cannot be before/)
  })

  it('refuses an id that appears twice', () => {
    const file = good()
    file.passes.push({ ...file.passes[0] })
    expect(refuse(file)).toMatch(/a pass appears twice/)
  })

  it('refuses things that point at what is not in the file', () => {
    const use = good()
    use.uses[0].passId = 'nope'
    expect(refuse(use)).toMatch(/recorded use 1 belongs to a pass that is not in the file/)
    const freeze = good()
    freeze.freezes[0].passId = 'nope'
    expect(refuse(freeze)).toMatch(/freeze 1 belongs to a pass/)
    const gym = good()
    gym.passes[0].gymRef = { kind: 'user', id: 'nope' }
    expect(refuse(gym)).toMatch(/pass 1 uses a gym that is not in the file/)
  })

  it('accepts a pass at a built-in gym the file does not list (built-in gyms are not in it)', () => {
    expect(parseBackup(backupToText(backup({ passes: [makeCounted()] }))).ok).toBe(true)
  })

  it('ignores fields it does not know, so a later version can add some', () => {
    const file = good()
    file.somethingNew = { a: 1 }
    file.passes[0].extra = 'x'
    expect(parseBackup(JSON.stringify(file)).ok).toBe(true)
  })

  it('accepts a backup with no settings', () => {
    const file = good()
    file.settings = null
    expect(parseBackup(JSON.stringify(file)).ok).toBe(true)
  })
})

describe('adding a backup to a device', () => {
  it('on an empty device, brings everything in', () => {
    const plan = planImport(snapshot(), backup(full()), BUILTIN)
    expect(plan.summary).toMatchObject({
      passesAdded: 4,
      passesUpdated: 0,
      usesAdded: 2,
      freezesChanged: 1,
      gymsAdded: 1,
      gymsMerged: 0,
      settings: 'added',
      nothingNew: false,
    })
    const after = apply(snapshot(), plan)
    expect(after.passes).toHaveLength(4)
    expect(after.settings?.lowEntriesThreshold).toBe(4)
  })

  it('doing it twice changes nothing the second time', () => {
    const file = backup(full())
    const once = apply(snapshot(), planImport(snapshot(), file, BUILTIN))
    const again = planImport(once, file, BUILTIN)
    expect(again.summary.nothingNew).toBe(true)
    expect(again.put).toEqual({
      userGyms: [],
      passes: [],
      uses: [],
      freezes: [],
      settings: undefined,
    })
  })

  it('keeps what is on the device that the file does not have', () => {
    const mine = makeCounted({ id: 'mine' })
    const plan = planImport(snapshot({ passes: [mine] }), backup(full()), BUILTIN)
    expect(plan.put.passes.map((p) => p.id)).not.toContain('mine')
    const after = apply(snapshot({ passes: [mine] }), plan)
    expect(after.passes.map((p) => p.id)).toContain('mine')
    expect(after.passes).toHaveLength(5)
  })

  describe('the same pass on both (last write wins)', () => {
    const local = (over: Partial<RecordMeta> = {}) =>
      snapshot({ passes: [makeCounted({ id: 'p', comments: 'here', updatedAt: T1, ...over })] })
    const file = (over: Partial<RecordMeta> = {}) =>
      backup({ passes: [makeCounted({ id: 'p', comments: 'file', ...over })] })

    it('a newer edit in the file replaces the one here', () => {
      const plan = planImport(local(), file({ updatedAt: T2 }), BUILTIN)
      expect(plan.summary.passesUpdated).toBe(1)
      expect(plan.put.passes[0]).toMatchObject({ comments: 'file' })
    })

    it('an older edit in the file is ignored', () => {
      const plan = planImport(local(), file({ updatedAt: T0 }), BUILTIN)
      expect(plan.put.passes).toEqual([])
      expect(plan.summary.nothingNew).toBe(true)
    })

    it('the same time keeps what is here', () => {
      const plan = planImport(local(), file({ updatedAt: T1 }), BUILTIN)
      expect(plan.put.passes).toEqual([])
    })

    it('compares moments, not text (different time zone offsets)', () => {
      const plan = planImport(
        local({ updatedAt: '2026-02-01T08:00:00.000+08:00' }),
        file({ updatedAt: '2026-02-01T00:00:00.000Z' }),
        BUILTIN,
      )
      expect(plan.put.passes).toEqual([]) // the same moment
    })
  })

  describe('deletions', () => {
    const live = (updatedAt: string) => makeCounted({ id: 'p', updatedAt })
    const gone = (updatedAt: string) => makeCounted({ id: 'p', updatedAt, deletedAt: updatedAt })

    it('a pass the file marks deleted is ignored and never removes the pass here', () => {
      const plan = planImport(
        snapshot({ passes: [live(T1)] }),
        backup({ passes: [gone(T2)] }),
        BUILTIN,
      )
      expect(plan.put.passes).toEqual([])
      expect(plan.summary.nothingNew).toBe(true)
      expect(apply(snapshot({ passes: [live(T1)] }), plan).passes[0]!.deletedAt).toBeNull()
    })

    it('the uses and freezes of a deleted pass in the file are ignored too', () => {
      const plan = planImport(
        snapshot(),
        backup({
          passes: [gone(T2)],
          uses: [makeUse('p', { id: 'u' })],
          freezes: [
            {
              id: 'f',
              passId: 'p',
              startDate: '2026-10-01',
              endDate: '2026-10-02',
              createdAt: T0,
              updatedAt: T0,
              deletedAt: null,
            },
          ],
        }),
        BUILTIN,
      )
      expect(plan.put.passes).toEqual([])
      expect(plan.put.uses).toEqual([])
      expect(plan.put.freezes).toEqual([])
      expect(plan.summary.nothingNew).toBe(true)
    })

    it('a deletion of something this device never had is ignored and not counted as new', () => {
      const plan = planImport(snapshot(), backup({ passes: [gone(T1)] }), BUILTIN)
      expect(plan.summary.passesAdded).toBe(0)
      expect(plan.summary.nothingNew).toBe(true)
      expect(plan.put.passes).toEqual([])
    })

    it('a recorded use that was undone elsewhere is removed here', () => {
      const pass = makeCounted({ id: 'p' })
      const here = makeUse('p', { id: 'u', updatedAt: T0 })
      const undone = makeUse('p', { id: 'u', updatedAt: T2, deletedAt: T2 })
      const plan = planImport(
        snapshot({ passes: [pass], uses: [here] }),
        backup({ passes: [pass], uses: [undone] }),
        BUILTIN,
      )
      expect(plan.summary).toMatchObject({ usesRemoved: 1, usesAdded: 0 })
    })

    it('counts new uses and new freezes', () => {
      const pass = makeCounted({ id: 'p' })
      const plan = planImport(
        snapshot({ passes: [pass] }),
        backup({
          passes: [pass],
          uses: [makeUse('p', { id: 'u1' }), makeUse('p', { id: 'u2' })],
          freezes: [makeFreeze('p', '2026-03-01', '2026-03-02') as Freeze],
        }),
        BUILTIN,
      )
      expect(plan.summary).toMatchObject({ usesAdded: 2, freezesChanged: 1, passesAdded: 0 })
    })
  })

  describe('gyms', () => {
    const passAt = (id: string, gymId: string) =>
      makeCounted({ id, gymRef: { kind: 'user', id: gymId } })

    it('a gym with the same name as one here is the same gym: no copy, and passes follow it', () => {
      const here = snapshot({ userGyms: [gym('mine', 'Fit Bloc')] })
      const file = backup({
        userGyms: [gym('theirs', '  fit  BLOC ')],
        passes: [passAt('p', 'theirs')],
      })
      const plan = planImport(here, file, BUILTIN)
      expect(plan.summary).toMatchObject({ gymsAdded: 0, gymsMerged: 1, passesAdded: 1 })
      expect(plan.put.userGyms).toEqual([])
      expect(plan.put.passes[0]!.gymRef).toEqual({ kind: 'user', id: 'mine' })
    })

    it('a gym named like a built-in gym becomes that built-in gym', () => {
      const file = backup({
        userGyms: [gym('theirs', 'boulder+')],
        passes: [passAt('p', 'theirs')],
      })
      const plan = planImport(snapshot(), file, BUILTIN)
      expect(plan.summary.gymsMerged).toBe(1)
      expect(plan.put.userGyms).toEqual([])
      expect(plan.put.passes[0]!.gymRef).toEqual({ kind: 'builtin', id: 'b-boulder' })
    })

    it('a new gym is added, and its passes keep pointing at it', () => {
      const file = backup({ userGyms: [gym('g', 'Brand New')], passes: [passAt('p', 'g')] })
      const plan = planImport(snapshot(), file, BUILTIN)
      expect(plan.summary.gymsAdded).toBe(1)
      expect(plan.put.passes[0]!.gymRef).toEqual({ kind: 'user', id: 'g' })
    })

    it('two gyms in the file with the same name become one', () => {
      const file = backup({
        userGyms: [gym('a', 'Same Name'), gym('b', 'same name')],
        passes: [passAt('p1', 'a'), passAt('p2', 'b')],
      })
      const plan = planImport(snapshot(), file, BUILTIN)
      expect(plan.put.userGyms.map((g) => g.id)).toEqual(['a'])
      expect(plan.put.passes.map((p) => p.gymRef)).toEqual([
        { kind: 'user', id: 'a' },
        { kind: 'user', id: 'a' },
      ])
    })

    it('the same gym id here and in the file is one gym: the newer name wins', () => {
      const here = snapshot({ userGyms: [gym('g', 'Old Name', { updatedAt: T0 })] })
      const plan = planImport(
        here,
        backup({ userGyms: [gym('g', 'New Name', { updatedAt: T2 })] }),
        BUILTIN,
      )
      expect(plan.put.userGyms[0]!.name).toBe('New Name')
      expect(plan.summary.gymsAdded).toBe(0)
    })

    it('importing the same file again after gyms were merged still changes nothing', () => {
      const here = snapshot({ userGyms: [gym('mine', 'Fit Bloc')] })
      const file = backup({
        userGyms: [gym('theirs', 'Fit Bloc')],
        passes: [passAt('p', 'theirs')],
      })
      const once = apply(here, planImport(here, file, BUILTIN))
      const again = planImport(once, file, BUILTIN)
      expect(again.summary.nothingNew).toBe(true)
      expect(again.put.passes).toEqual([])
    })

    it('a deleted gym in the file is not counted as new, and does not capture the name', () => {
      const file = backup({ userGyms: [gym('x', 'Gone Gym', { deletedAt: T1, updatedAt: T1 })] })
      const plan = planImport(snapshot(), file, BUILTIN)
      expect(plan.summary.gymsAdded).toBe(0)
      expect(plan.summary.nothingNew).toBe(true)
    })
  })

  describe('settings', () => {
    it('are taken when this device has none saved', () => {
      const plan = planImport(snapshot(), backup({ settings: settings() }), BUILTIN)
      expect(plan.summary.settings).toBe('added')
      expect(plan.put.settings).toBeDefined()
    })

    it('a newer, different set replaces the one here', () => {
      const here = snapshot({ settings: settings({ updatedAt: T0 }) })
      const plan = planImport(
        here,
        backup({ settings: settings({ updatedAt: T2, lowEntriesThreshold: 5 }) }),
        BUILTIN,
      )
      expect(plan.summary).toMatchObject({ settings: 'updated', nothingNew: false })
      expect(plan.put.settings?.lowEntriesThreshold).toBe(5)
    })

    it('an older set is ignored', () => {
      const here = snapshot({ settings: settings({ updatedAt: T2, lowEntriesThreshold: 9 }) })
      const plan = planImport(
        here,
        backup({ settings: settings({ updatedAt: T0, lowEntriesThreshold: 5 }) }),
        BUILTIN,
      )
      expect(plan.summary.settings).toBe('kept')
      expect(plan.put.settings).toBeUndefined()
    })

    it('a newer set that says the same thing is not news', () => {
      const here = snapshot({ settings: settings({ updatedAt: T0 }) })
      const plan = planImport(here, backup({ settings: settings({ updatedAt: T2 }) }), BUILTIN)
      expect(plan.summary).toMatchObject({ settings: 'kept', nothingNew: true })
    })

    it('a backup with none leaves this device’s alone', () => {
      const here = snapshot({ settings: settings() })
      const plan = planImport(here, backup(), BUILTIN)
      expect(plan.summary.settings).toBe('none')
    })
  })
})
