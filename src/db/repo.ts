import { BUILTIN_GYMS } from '../data/gyms'
import {
  canUseEntry,
  planGiveBack,
  type GiveBackPlan,
  type UseBlockReason,
} from '../domain/counter'
import {
  buildBackup,
  planImport,
  type Backup,
  type ImportSummary,
  type Snapshot,
} from '../domain/backup'
import { currentPeriod, usesInPeriod } from '../domain/cycle'
import { localDateOfTimestamp, moveTimestampToDate, type LocalDate } from '../domain/dates'
import { checkUseDate, type UseDateProblem } from '../domain/history'
import { buildGymList, resolveGymInput, type BuiltinGym, type GymEntry } from '../domain/gyms'
import {
  freezeInputSchema,
  freezeRangeSchema,
  passInputSchema,
  settingsSchema,
  userGymInputSchema,
} from '../domain/schemas'
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings'
import {
  isMonthly,
  type Freeze,
  type FreezeInput,
  type GymRef,
  type MonthlyMembership,
  type Pass,
  type PassBundle,
  type PassFields,
  type PassInput,
  type RecordMeta,
  type Use,
} from '../domain/types'
import type { ClimbDB, SettingsRow } from './db'

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`)
    // Not 'NotFoundError': Dexie rewrites errors with that name into its own DexieError.
    this.name = 'RecordNotFoundError'
  }
}

export interface RepoOptions {
  /** ISO timestamp for "now". Injectable for tests. */
  now?: () => string
  newId?: () => string
  /** The built-in gym list. Defaults to the bundled one. */
  builtinGyms?: BuiltinGym[]
}

export type UpdateUseDateResult = { ok: true; use: Use } | ({ ok: false } & UseDateProblem)
export type UseEntryResult = { ok: true; use: Use } | { ok: false; reason: UseBlockReason }
export type GiveBackResult =
  Extract<GiveBackPlan, { ok: true }> | Extract<GiveBackPlan, { ok: false }>

/** Where the backup reminder keeps its two facts (D47). */
const LAST_BACKUP_KEY = 'lastBackupAt'
const BACKUP_SNOOZE_KEY = 'backupNudgeSnoozedUntil'

const isLive = <T extends { deletedAt: string | null }>(row: T): boolean => row.deletedAt === null

/** Midnight at the start of `date`, in the device's time zone, as an ISO timestamp. */
function startOfDay(date: LocalDate): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return new Date(year, month - 1, day).toISOString()
}

/**
 * All reads and writes the app makes to the on-device database.
 *
 * - Writes validate their input and always set `createdAt` / `updatedAt`. Deleting a pass removes it
 *   for good; removing a use, a freeze or a user gym sets `deletedAt` (so a backup can carry it):
 *   reads return live rows only.
 * - `−` and `+` (`useEntry`, `giveBackEntry`) check the rules from `src/domain/counter.ts` and
 *   change the data inside one transaction, so a double tap can never count twice.
 * - Reads are plain async functions, so they can be used directly inside `useLiveQuery`.
 */
export function createRepo(db: ClimbDB, options: RepoOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString())
  const newId = options.newId ?? (() => crypto.randomUUID())
  const builtinGyms = options.builtinGyms ?? BUILTIN_GYMS

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

  /**
   * Adds a pass. For a membership with a monthly allowance, `usedThisPeriod` records that many
   * entries as already used this month (as uses stamped at the start of the current period), so
   * they count now and drop away at the next reset. Not allowed for any other pass type, which
   * has `initialUsed` instead.
   */
  async function createPass(
    input: PassInput,
    extra?: { usedThisPeriod: number; today: LocalDate },
  ): Promise<Pass> {
    const parsed = passInputSchema.parse(input)
    const pass: Pass = create(parsed)
    return db.transaction('rw', db.passes, db.uses, async () => {
      await db.passes.add(pass)
      if (extra && extra.usedThisPeriod > 0) {
        if (!isMonthly(pass))
          throw new Error('Only a membership with entries per month has a monthly count')
        if (!Number.isInteger(extra.usedThisPeriod) || extra.usedThisPeriod > pass.monthlyEntries) {
          throw new Error(`Used this month must be a whole number up to ${pass.monthlyEntries}`)
        }
        const usedAt = startOfDay(currentPeriod(pass, extra.today).start)
        const uses = Array.from({ length: extra.usedThisPeriod }, (): Use =>
          create({ passId: pass.id, usedAt }),
        )
        await db.uses.bulkAdd(uses)
      }
      return pass
    })
  }

  /** Replaces a pass's fields with `input` (the whole row). The type may change. */
  async function updatePass(id: string, input: PassInput): Promise<Pass> {
    const parsed = passInputSchema.parse(input)
    return db.transaction('rw', db.passes, async () => {
      const existing = requireLive(await db.passes.get(id), 'Pass', id)
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

  /** Every live pass with its live uses and freezes, as the main screen loads them. */
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

  /**
   * Deletes a pass for good, together with all of its uses and freezes (FR-19, D52). Nothing is
   * kept: no flagged copy stays behind.
   */
  async function deletePass(id: string): Promise<void> {
    await db.transaction('rw', db.passes, db.uses, db.freezes, async () => {
      requireLive(await db.passes.get(id), 'Pass', id)
      await db.uses.where('passId').equals(id).delete()
      await db.freezes.where('passId').equals(id).delete()
      await db.passes.delete(id)
    })
  }

  // ---- The counter: − and + ---------------------------------------------------------------

  /**
   * `−`: uses one entry, if the rules allow it (D25, FR-9, FR-11, FR-12). `today` is the local
   * date; `at` is the moment recorded on the use (now, unless a test says otherwise).
   */
  async function useEntry(
    passId: string,
    today: LocalDate,
    at: string = now(),
  ): Promise<UseEntryResult> {
    return db.transaction('rw', db.passes, db.uses, db.freezes, async () => {
      const pass = requireLive(await db.passes.get(passId), 'Pass', passId)
      const uses = (await db.uses.where('passId').equals(passId).toArray()).filter(isLive)
      const freezes = (await db.freezes.where('passId').equals(passId).toArray()).filter(isLive)
      const check = canUseEntry(pass, uses, freezes, today)
      if (!check.ok) return check
      const use: Use = create({ passId, usedAt: at })
      await db.uses.add(use)
      return { ok: true, use }
    })
  }

  /** `+`: gives one entry back (FR-52). See `planGiveBack` for exactly what that means. */
  async function giveBackEntry(passId: string, today: LocalDate): Promise<GiveBackResult> {
    return db.transaction('rw', db.passes, db.uses, db.freezes, async () => {
      const pass = requireLive(await db.passes.get(passId), 'Pass', passId)
      const uses = (await db.uses.where('passId').equals(passId).toArray()).filter(isLive)
      const freezes = (await db.freezes.where('passId').equals(passId).toArray()).filter(isLive)
      const plan = planGiveBack(pass, uses, freezes, today)
      if (!plan.ok) return plan
      const t = now()
      if (plan.action === 'remove_use') {
        const use = uses.find((u) => u.id === plan.useId)!
        await db.uses.put(tombstone(use, t))
      } else if (pass.passType !== 'membership') {
        // `initialUsed` is a plain number on every counted type; the spread over the union just
        // trips up the compiler.
        await db.passes.put({ ...pass, initialUsed: pass.initialUsed - 1, updatedAt: t } as Pass)
      }
      return plan
    })
  }

  /**
   * Changes the date of a recorded use (D58): the time of day stays, so uses on one day keep their
   * order. Refused (nothing is written) when the date breaks the rules in `checkUseDate`. Giving the
   * date it already has changes nothing. The check and the write are one transaction.
   */
  async function updateUseDate(
    useId: string,
    date: LocalDate,
    today: LocalDate,
  ): Promise<UpdateUseDateResult> {
    return db.transaction('rw', db.passes, db.uses, db.freezes, async () => {
      const use = requireLive(await db.uses.get(useId), 'Use', useId)
      const pass = requireLive(await db.passes.get(use.passId), 'Pass', use.passId)
      const uses = (await db.uses.where('passId').equals(pass.id).toArray()).filter(isLive)
      const freezes = (await db.freezes.where('passId').equals(pass.id).toArray()).filter(isLive)
      const check = checkUseDate(pass, use, uses, freezes, date, today)
      if (!check.ok) return check
      if (localDateOfTimestamp(use.usedAt) === date) return { ok: true, use }
      const updated: Use = {
        ...use,
        usedAt: moveTimestampToDate(use.usedAt, date),
        updatedAt: now(),
      }
      await db.uses.put(updated)
      return { ok: true, use: updated }
    })
  }

  /**
   * Removes one recorded use from the history (D58). Like `+`, it only flags the use as deleted, so
   * a backup can carry the deletion; the entries left go up by one because they are derived.
   */
  async function deleteUse(useId: string): Promise<void> {
    await db.transaction('rw', db.passes, db.uses, async () => {
      const use = requireLive(await db.uses.get(useId), 'Use', useId)
      requireLive(await db.passes.get(use.passId), 'Pass', use.passId)
      await db.uses.put(tombstone(use, now()))
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

  // ---- Gyms -------------------------------------------------------------------------------

  async function listUserGyms() {
    return (await db.userGyms.toArray()).filter(isLive)
  }

  /**
   * Built-in and user-added gyms together, sorted by name: the autocomplete's source. A gym a person
   * added that no pass uses any more is marked inactive, so it stops being suggested (D56).
   */
  async function listGyms(): Promise<GymEntry[]> {
    const [userGyms, passes] = await Promise.all([listUserGyms(), db.passes.toArray()])
    const inUse = new Set(
      passes.filter(isLive).flatMap((p) => (p.gymRef.kind === 'user' ? [p.gymRef.id] : [])),
    )
    return buildGymList(builtinGyms, userGyms, inUse)
  }

  /**
   * Turns the text typed into a row's gym cell into a gym (D24, FR-25, FR-53). Text that equals an
   * existing gym (ignoring case and punctuation) uses that gym; anything else is saved as a new
   * private gym. The lookup and the save are one transaction, so two quick submits of the same new
   * name create one gym, not two. Empty or too-long text throws a validation error.
   */
  async function findOrCreateGym(typed: string): Promise<{ ref: GymRef; created: boolean }> {
    return db.transaction('rw', db.userGyms, async () => {
      const gyms = buildGymList(builtinGyms, (await db.userGyms.toArray()).filter(isLive))
      const choice = resolveGymInput(typed, gyms)
      if (choice.kind === 'existing') return { ref: choice.gym.ref, created: false }
      const { name } = userGymInputSchema.parse({ name: choice.kind === 'new' ? choice.name : '' })
      const gym = create({ name })
      await db.userGyms.add(gym)
      return { ref: { kind: 'user', id: gym.id }, created: true }
    })
  }

  /**
   * Saves a new row from the main screen (FR-54): turns the gym cell's text into a gym and creates
   * the pass for it, in one transaction. If the pass is invalid nothing is saved, so a failed row
   * never leaves a stray gym behind.
   */
  async function createPassForGymText(gymText: string, pass: PassFields): Promise<Pass> {
    return db.transaction('rw', db.userGyms, db.passes, db.uses, async () => {
      const { ref } = await findOrCreateGym(gymText)
      return createPass({ ...pass, gymRef: ref } as PassInput)
    })
  }

  /**
   * Saves an edited row from its details panel (FR-17, FR-18, FR-58): the gym text becomes a gym,
   * the pass fields replace the old ones, and for a monthly membership `usedThisMonth` (when not
   * null) sets how many entries count as used in the current period. All in one transaction, so a
   * failure changes nothing. Changing the reset day or the allowance needs no extra step: the
   * count is derived from the recorded uses.
   */
  async function saveRow(
    id: string,
    gymText: string,
    fields: PassFields,
    options: { usedThisMonth: number | null; today: LocalDate },
  ): Promise<Pass> {
    return db.transaction('rw', db.userGyms, db.passes, db.uses, async () => {
      const { ref } = await findOrCreateGym(gymText)
      const pass = await updatePass(id, { ...fields, gymRef: ref } as PassInput)
      if (options.usedThisMonth !== null && isMonthly(pass)) {
        await setUsedThisPeriod(pass, options.usedThisMonth, options.today)
      }
      return pass
    })
  }

  /**
   * Makes this period's count of used entries `target`. More: adds uses stamped at the start of
   * the period (as `createPass` does). Fewer: removes the most recent uses of the period.
   */
  async function setUsedThisPeriod(
    pass: MonthlyMembership,
    target: number,
    today: LocalDate,
  ): Promise<void> {
    if (!Number.isInteger(target) || target < 0 || target > pass.monthlyEntries) {
      throw new Error(`Used this month must be a whole number up to ${pass.monthlyEntries}`)
    }
    const period = currentPeriod(pass, today)
    const uses = (await db.uses.where('passId').equals(pass.id).toArray()).filter(isLive)
    const inPeriod = usesInPeriod(pass, uses, period).sort((a, b) =>
      a.usedAt < b.usedAt ? -1 : a.usedAt > b.usedAt ? 1 : 0,
    )
    if (target > inPeriod.length) {
      const usedAt = startOfDay(period.start)
      const added = Array.from({ length: target - inPeriod.length }, (): Use =>
        create({ passId: pass.id, usedAt }),
      )
      await db.uses.bulkAdd(added)
    } else if (target < inPeriod.length) {
      const t = now()
      const removed = inPeriod.slice(target).map((use) => tombstone(use, t))
      await db.uses.bulkPut(removed)
    }
  }

  // ---- Settings ---------------------------------------------------------------------------

  /**
   * The saved settings, or the defaults. It never fails: a missing row, a missing field or a field
   * holding something that is no longer valid falls back to its default, so a bad stored value can
   * never stop the main screen from opening.
   */
  async function getSettings(): Promise<Settings> {
    const row = (await db.settings.get('settings')) as Record<string, unknown> | undefined
    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS }
    if (!row) return settings as unknown as Settings
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const parsed = settingsSchema.shape[key].safeParse(row[key])
      if (parsed.success) settings[key] = parsed.data
    }
    return settings as unknown as Settings
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

  /** Dismisses several reminders at once, in one write, so none is lost. */
  async function dismissReminders(entries: { key: string; value: number }[]): Promise<Settings> {
    return db.transaction('rw', db.settings, async () => {
      const current = await getSettings()
      const dismissedReminders = { ...current.dismissedReminders }
      for (const { key, value } of entries) dismissedReminders[key] = value
      return updateSettings({ dismissedReminders })
    })
  }

  // ---- Backup and import (D37, D38) ----------------------------------------------------------

  /** Every row on the device, deleted ones included, so a backup can carry deletions too. */
  async function readSnapshot(): Promise<Snapshot> {
    const [userGyms, passes, uses, freezes, settingsRow] = await Promise.all([
      db.userGyms.toArray(),
      db.passes.toArray(),
      db.uses.toArray(),
      db.freezes.toArray(),
      db.settings.get('settings'),
    ])
    return {
      userGyms,
      passes,
      uses,
      freezes,
      settings: settingsRow
        ? { ...(await getSettings()), updatedAt: settingsRow.updatedAt }
        : undefined,
    }
  }

  /** The backup file for what is on the device now. */
  async function exportBackup(): Promise<Backup> {
    return buildBackup(await readSnapshot(), now())
  }

  /** What importing this backup would do, without doing it. */
  async function previewImport(backup: Backup): Promise<ImportSummary> {
    return planImport(await readSnapshot(), backup, builtinGyms).summary
  }

  /**
   * Adds a backup to what is on the device, in one transaction: either all of it is written or none
   * of it is. See `planImport` for the rules. The backup must already have been checked with
   * `parseBackup`.
   */
  async function importBackup(backup: Backup): Promise<ImportSummary> {
    const summary = await db.transaction(
      'rw',
      [db.userGyms, db.passes, db.uses, db.freezes, db.settings],
      async () => {
        const plan = planImport(await readSnapshot(), backup, builtinGyms)
        await db.userGyms.bulkPut(plan.put.userGyms)
        await db.passes.bulkPut(plan.put.passes)
        await db.uses.bulkPut(plan.put.uses)
        await db.freezes.bulkPut(plan.put.freezes)
        if (plan.put.settings) {
          const { updatedAt, ...values } = plan.put.settings
          await db.settings.put({ ...values, id: 'settings', updatedAt })
        }
        return plan.summary
      },
    )
    // What is on this device is now in the file the person opened, so it counts as backed up.
    await markBackedUp()
    return summary
  }

  // ---- The backup reminder (D47) ----------------------------------------------------------

  async function getBackupState(): Promise<{
    lastBackupAt: string | null
    snoozedUntil: LocalDate | null
  }> {
    const last = await getMeta<unknown>(LAST_BACKUP_KEY)
    const snoozed = await getMeta<unknown>(BACKUP_SNOOZE_KEY)
    return {
      lastBackupAt: typeof last === 'string' ? last : null,
      snoozedUntil: typeof snoozed === 'string' ? snoozed : null,
    }
  }

  /** A backup file was downloaded (or opened): starts the 30 days again. */
  async function markBackedUp(): Promise<void> {
    await setMeta(LAST_BACKUP_KEY, now())
    await db.meta.delete(BACKUP_SNOOZE_KEY)
  }

  /** "Remind me later": the reminder stays away until `until`. */
  async function snoozeBackupNudge(until: LocalDate): Promise<void> {
    await setMeta(BACKUP_SNOOZE_KEY, until)
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
    useEntry,
    giveBackEntry,
    listUses,
    updateUseDate,
    deleteUse,
    addFreeze,
    updateFreeze,
    deleteFreeze,
    listUserGyms,
    listGyms,
    findOrCreateGym,
    createPassForGymText,
    saveRow,
    getSettings,
    updateSettings,
    dismissReminder,
    dismissReminders,
    getMeta,
    setMeta,
    readSnapshot,
    exportBackup,
    previewImport,
    importBackup,
    getBackupState,
    markBackedUp,
    snoozeBackupNudge,
    clearAllData,
  }
}

export type Repo = ReturnType<typeof createRepo>
