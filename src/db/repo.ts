import {
  freezeInputSchema,
  freezeRangeSchema,
  passInputSchema,
  settingsSchema,
  useInputSchema,
  userGymInputSchema,
  userTemplateInputSchema,
} from '../domain/schemas'
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings'
import type {
  Freeze,
  FreezeInput,
  GymRef,
  Pass,
  PassBundle,
  PassInput,
  RecordMeta,
  Use,
  UseInput,
  UserGym,
  UserGymInput,
  UserTemplate,
  UserTemplateInput,
} from '../domain/types'
import type { ClimbDB, SettingsRow } from './db'

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`)
    // Not 'NotFoundError': Dexie rewrites errors with that name into its own DexieError.
    this.name = 'RecordNotFoundError'
  }
}

export class GymInUseError extends Error {
  constructor(gymId: string) {
    super(`Gym ${gymId} still has passes`)
    this.name = 'GymInUseError'
  }
}

export interface RepoOptions {
  /** ISO timestamp for "now". Injectable for tests. */
  now?: () => string
  newId?: () => string
}

const isLive = <T extends { deletedAt: string | null }>(row: T): boolean => row.deletedAt === null

/**
 * All reads and writes the app makes to the on-device database.
 *
 * - Writes validate their input, always set `createdAt` / `updatedAt`, and never hard-delete:
 *   deleting sets `deletedAt` (so deletions can sync later). Reads return live rows only.
 * - This is storage, not business logic. Whether a use may be logged (entries left, expiry, ...)
 *   is decided by `canLogUse` in `src/domain/rules.ts` before `addUse` is called.
 * - Reads are plain async functions, so they can be used directly inside `useLiveQuery`.
 */
export function createRepo(db: ClimbDB, options: RepoOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString())
  const newId = options.newId ?? (() => crypto.randomUUID())

  function create<T extends object>(input: T): T & RecordMeta {
    const t = now()
    return { ...input, id: newId(), createdAt: t, updatedAt: t, deletedAt: null }
  }

  function requireLive<T extends RecordMeta>(row: T | undefined, what: string, id: string): T {
    if (!row || !isLive(row)) throw new NotFoundError(what, id)
    return row
  }

  const tombstone = <T extends RecordMeta>(row: T, t: string): T => ({
    ...row,
    deletedAt: t,
    updatedAt: t,
  })

  // ---- Passes -----------------------------------------------------------------------------

  async function createPass(input: PassInput): Promise<Pass> {
    const pass: Pass = create(passInputSchema.parse(input))
    await db.passes.add(pass)
    return pass
  }

  /** Replaces a pass's fields with `input` (the whole form). A pass can't change type. */
  async function updatePass(id: string, input: PassInput): Promise<Pass> {
    const parsed = passInputSchema.parse(input)
    return db.transaction('rw', db.passes, async () => {
      const existing = requireLive(await db.passes.get(id), 'Pass', id)
      if (existing.passType !== parsed.passType) throw new Error('A pass cannot change type')
      const updated: Pass = {
        ...parsed,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        deletedAt: null,
      }
      await db.passes.put(updated)
      return updated
    })
  }

  async function getPass(id: string): Promise<Pass | undefined> {
    const row = await db.passes.get(id)
    return row && isLive(row) ? row : undefined
  }

  async function listPasses(): Promise<Pass[]> {
    return (await db.passes.toArray()).filter(isLive)
  }

  /** Every live pass with its live uses and freezes, as the dashboard and history load them. */
  async function listBundles(): Promise<PassBundle[]> {
    return db.transaction('r', db.passes, db.uses, db.freezes, async () => {
      const [passes, uses, freezes] = await Promise.all([
        db.passes.toArray(),
        db.uses.toArray(),
        db.freezes.toArray(),
      ])
      const group = <T extends { passId: string; deletedAt: string | null }>(rows: T[]) => {
        const map = new Map<string, T[]>()
        for (const row of rows.filter(isLive)) {
          const list = map.get(row.passId)
          if (list) list.push(row)
          else map.set(row.passId, [row])
        }
        return map
      }
      const usesByPass = group(uses)
      const freezesByPass = group(freezes)
      return passes.filter(isLive).map((pass) => ({
        pass,
        uses: usesByPass.get(pass.id) ?? [],
        freezes: freezesByPass.get(pass.id) ?? [],
      }))
    })
  }

  /** Deletes a pass together with its uses and freezes (FR-19). */
  async function deletePass(id: string): Promise<void> {
    await db.transaction('rw', db.passes, db.uses, db.freezes, async () => {
      const pass = requireLive(await db.passes.get(id), 'Pass', id)
      const t = now()
      const uses = (await db.uses.where('passId').equals(id).toArray()).filter(isLive)
      const freezes = (await db.freezes.where('passId').equals(id).toArray()).filter(isLive)
      await db.passes.put(tombstone(pass, t))
      await db.uses.bulkPut(uses.map((u) => tombstone(u, t)))
      await db.freezes.bulkPut(freezes.map((f) => tombstone(f, t)))
    })
  }

  // ---- Uses -------------------------------------------------------------------------------

  async function addUse(input: UseInput): Promise<Use> {
    const parsed = useInputSchema.parse(input)
    return db.transaction('rw', db.passes, db.uses, async () => {
      requireLive(await db.passes.get(parsed.passId), 'Pass', parsed.passId)
      const use: Use = create(parsed)
      await db.uses.add(use)
      return use
    })
  }

  async function updateUse(id: string, changes: Pick<UseInput, 'usedAt' | 'note'>): Promise<Use> {
    const parsed = useInputSchema.pick({ usedAt: true, note: true }).parse(changes)
    return db.transaction('rw', db.uses, async () => {
      const existing = requireLive(await db.uses.get(id), 'Use', id)
      const updated: Use = { ...existing, ...parsed, updatedAt: now() }
      await db.uses.put(updated)
      return updated
    })
  }

  async function deleteUse(id: string): Promise<void> {
    await db.transaction('rw', db.uses, async () => {
      await db.uses.put(tombstone(requireLive(await db.uses.get(id), 'Use', id), now()))
    })
  }

  async function listUses(passId: string): Promise<Use[]> {
    return (await db.uses.where('passId').equals(passId).toArray()).filter(isLive)
  }

  // ---- Freezes (memberships) --------------------------------------------------------------

  async function addFreeze(input: FreezeInput): Promise<Freeze> {
    const parsed = freezeInputSchema.parse(input)
    return db.transaction('rw', db.passes, db.freezes, async () => {
      const pass = requireLive(await db.passes.get(parsed.passId), 'Pass', parsed.passId)
      if (pass.passType !== 'membership') throw new Error('Only memberships can be frozen')
      const freeze: Freeze = create(parsed)
      await db.freezes.add(freeze)
      return freeze
    })
  }

  async function updateFreeze(
    id: string,
    changes: Pick<FreezeInput, 'startDate' | 'endDate'>,
  ): Promise<Freeze> {
    const parsed = freezeRangeSchema.parse(changes)
    return db.transaction('rw', db.freezes, async () => {
      const existing = requireLive(await db.freezes.get(id), 'Freeze', id)
      const updated: Freeze = { ...existing, ...parsed, updatedAt: now() }
      await db.freezes.put(updated)
      return updated
    })
  }

  async function deleteFreeze(id: string): Promise<void> {
    await db.transaction('rw', db.freezes, async () => {
      await db.freezes.put(tombstone(requireLive(await db.freezes.get(id), 'Freeze', id), now()))
    })
  }

  // ---- User-added gyms and templates ------------------------------------------------------

  async function addUserGym(input: UserGymInput): Promise<UserGym> {
    const gym: UserGym = create(userGymInputSchema.parse(input))
    await db.userGyms.add(gym)
    return gym
  }

  async function updateUserGym(id: string, input: UserGymInput): Promise<UserGym> {
    const parsed = userGymInputSchema.parse(input)
    return db.transaction('rw', db.userGyms, async () => {
      const updated: UserGym = {
        ...requireLive(await db.userGyms.get(id), 'Gym', id),
        ...parsed,
        updatedAt: now(),
      }
      await db.userGyms.put(updated)
      return updated
    })
  }

  async function getUserGym(id: string): Promise<UserGym | undefined> {
    const row = await db.userGyms.get(id)
    return row && isLive(row) ? row : undefined
  }

  async function listUserGyms(): Promise<UserGym[]> {
    return (await db.userGyms.toArray()).filter(isLive)
  }

  /** Deletes a user gym and its templates. Refused while passes still belong to the gym. */
  async function deleteUserGym(id: string): Promise<void> {
    await db.transaction('rw', db.userGyms, db.userTemplates, db.passes, async () => {
      const gym = requireLive(await db.userGyms.get(id), 'Gym', id)
      const passes = await db.passes.where('gymRef.id').equals(id).toArray()
      if (passes.some(isLive)) throw new GymInUseError(id)
      const t = now()
      const templates = (await db.userTemplates.where('gymRef.id').equals(id).toArray()).filter(
        isLive,
      )
      await db.userGyms.put(tombstone(gym, t))
      await db.userTemplates.bulkPut(templates.map((tpl) => tombstone(tpl, t)))
    })
  }

  async function addUserTemplate(input: UserTemplateInput): Promise<UserTemplate> {
    const template: UserTemplate = create(userTemplateInputSchema.parse(input))
    await db.userTemplates.add(template)
    return template
  }

  async function updateUserTemplate(id: string, input: UserTemplateInput): Promise<UserTemplate> {
    const parsed = userTemplateInputSchema.parse(input)
    return db.transaction('rw', db.userTemplates, async () => {
      const updated: UserTemplate = {
        ...requireLive(await db.userTemplates.get(id), 'Template', id),
        ...parsed,
        updatedAt: now(),
      }
      await db.userTemplates.put(updated)
      return updated
    })
  }

  async function deleteUserTemplate(id: string): Promise<void> {
    await db.transaction('rw', db.userTemplates, async () => {
      const row = requireLive(await db.userTemplates.get(id), 'Template', id)
      await db.userTemplates.put(tombstone(row, now()))
    })
  }

  async function getUserTemplate(id: string): Promise<UserTemplate | undefined> {
    const row = await db.userTemplates.get(id)
    return row && isLive(row) ? row : undefined
  }

  /** User templates, optionally only those for one gym. */
  async function listUserTemplates(gymRef?: GymRef): Promise<UserTemplate[]> {
    const rows = gymRef
      ? await db.userTemplates.where('gymRef.id').equals(gymRef.id).toArray()
      : await db.userTemplates.toArray()
    return rows.filter((r) => isLive(r) && (!gymRef || r.gymRef.kind === gymRef.kind))
  }

  // ---- Hidden built-in gyms ---------------------------------------------------------------

  async function hideGym(gymId: string): Promise<void> {
    await db.transaction('rw', db.hiddenGyms, async () => {
      const t = now()
      const existing = await db.hiddenGyms.get(gymId)
      await db.hiddenGyms.put({
        id: gymId,
        createdAt: existing?.createdAt ?? t,
        updatedAt: t,
        deletedAt: null,
      })
    })
  }

  async function unhideGym(gymId: string): Promise<void> {
    await db.transaction('rw', db.hiddenGyms, async () => {
      const existing = await db.hiddenGyms.get(gymId)
      if (existing && isLive(existing)) await db.hiddenGyms.put(tombstone(existing, now()))
    })
  }

  async function listHiddenGymIds(): Promise<string[]> {
    return (await db.hiddenGyms.toArray()).filter(isLive).map((g) => g.id)
  }

  // ---- Settings ---------------------------------------------------------------------------

  async function getSettings(): Promise<Settings> {
    const row = await db.settings.get('settings')
    if (!row) return { ...DEFAULT_SETTINGS }
    // Stored rows also hold `id` / `updatedAt`; parsing keeps only the settings fields.
    return { ...DEFAULT_SETTINGS, ...settingsSchema.partial().parse(row) }
  }

  async function updateSettings(changes: Partial<Settings>): Promise<Settings> {
    return db.transaction('rw', db.settings, async () => {
      const current = await getSettings()
      const next = settingsSchema.parse({ ...current, ...changes })
      const row: SettingsRow = { ...next, id: 'settings', updatedAt: now() }
      await db.settings.put(row)
      return next
    })
  }

  /** Remember a dismissed banner. `value` comes from `dismissalValue()` in the reminders module. */
  async function dismissReminder(key: string, value: number): Promise<Settings> {
    const current = await getSettings()
    return updateSettings({ dismissedReminders: { ...current.dismissedReminders, [key]: value } })
  }

  // ---- Meta and wipe ----------------------------------------------------------------------

  async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
    return (await db.meta.get(key))?.value as T | undefined
  }

  async function setMeta(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value })
  }

  /** Removes everything from this device (FR-47, and sign-out later). Not a soft delete. */
  async function clearAllData(): Promise<void> {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()))
    })
  }

  return {
    createPass,
    updatePass,
    getPass,
    listPasses,
    listBundles,
    deletePass,
    addUse,
    updateUse,
    deleteUse,
    listUses,
    addFreeze,
    updateFreeze,
    deleteFreeze,
    addUserGym,
    updateUserGym,
    getUserGym,
    listUserGyms,
    deleteUserGym,
    addUserTemplate,
    updateUserTemplate,
    deleteUserTemplate,
    getUserTemplate,
    listUserTemplates,
    hideGym,
    unhideGym,
    listHiddenGymIds,
    getSettings,
    updateSettings,
    dismissReminder,
    getMeta,
    setMeta,
    clearAllData,
  }
}

export type Repo = ReturnType<typeof createRepo>
