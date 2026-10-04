import { z } from 'zod'
import { normalizeGymName, type BuiltinGym } from './gyms'
import {
  freezeInputSchema,
  passInputSchema,
  settingsSchema,
  useInputSchema,
  userGymInputSchema,
} from './schemas'
import type { Settings } from './settings'
import type { Freeze, GymRef, Pass, RecordMeta, Use, UserGym } from './types'

/**
 * Moving to another device (D37): a backup file written on one device and read on another. There
 * is no account and no server, so the file is the only way data travels. This module is the file's
 * format, how a file is checked, and the rules for merging one into a device that already has data.
 */

export const BACKUP_FORMAT = 'climb-pass-tracker-backup'
export const BACKUP_VERSION = 1

/** The settings as saved on the device: the values plus when they last changed. */
export type StoredSettings = Settings & { updatedAt: string }

/** Everything the app holds, deleted rows included (a deletion is a row with `deletedAt` set). */
export interface Snapshot {
  userGyms: UserGym[]
  passes: Pass[]
  uses: Use[]
  freezes: Freeze[]
  settings: StoredSettings | undefined
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  userGyms: UserGym[]
  passes: Pass[]
  uses: Use[]
  freezes: Freeze[]
  settings: StoredSettings | null
}

// ---- Writing a backup ---------------------------------------------------------------------

const byCreated = (a: RecordMeta, b: RecordMeta) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1

/** The file's contents for this snapshot. Rows are sorted so the same data gives the same file. */
export function buildBackup(snapshot: Snapshot, exportedAt: string): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    userGyms: [...snapshot.userGyms].sort(byCreated),
    passes: [...snapshot.passes].sort(byCreated),
    uses: [...snapshot.uses].sort(byCreated),
    freezes: [...snapshot.freezes].sort(byCreated),
    settings: snapshot.settings ?? null,
  }
}

export function backupToText(backup: Backup): string {
  return JSON.stringify(backup, null, 2)
}

/** `climb-pass-tracker-backup-2026-10-04.json` */
export function backupFilename(today: string): string {
  return `climb-pass-tracker-backup-${today}.json`
}

// ---- Reading a backup ---------------------------------------------------------------------

const timestamp = z.iso.datetime({ offset: true })
const recordMeta = z.object({
  id: z.string().min(1).max(100),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
})

const envelope = z.object({ format: z.literal(BACKUP_FORMAT), version: z.number().int().min(1) })

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: timestamp,
  userGyms: z.array(z.intersection(userGymInputSchema, recordMeta)),
  passes: z.array(z.intersection(passInputSchema, recordMeta)),
  uses: z.array(z.intersection(useInputSchema, recordMeta)),
  freezes: z.array(z.intersection(freezeInputSchema, recordMeta)),
  settings: z.intersection(settingsSchema, z.object({ updatedAt: timestamp })).nullable(),
})

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string }

const NOT_A_BACKUP = 'This is not a Climb Pass Tracker backup file.'
const NOTHING_IMPORTED = 'Nothing was imported.'

const NOUN: Record<string, string> = {
  userGyms: 'gym',
  passes: 'pass',
  uses: 'recorded use',
  freezes: 'freeze',
  settings: 'settings',
}

/** "pass 3: Entries must be at least 1": where in the file the first problem is. */
function describeIssue(issue: z.core.$ZodIssue): string {
  const [list, index] = issue.path
  const noun = typeof list === 'string' ? NOUN[list] : undefined
  if (!noun) return issue.message
  return typeof index === 'number'
    ? `${noun} ${index + 1}: ${issue.message}`
    : `${noun}: ${issue.message}`
}

function firstDuplicate(records: { id: string }[]): string | null {
  const seen = new Set<string>()
  for (const { id } of records) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}

/**
 * Checks the text of a file before anything is changed. A file that is not valid, or that points
 * at things it does not contain, is refused whole with a message saying why: importing is all or
 * nothing.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    // A byte-order mark at the start (some editors add one) is not part of the JSON.
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return {
      ok: false,
      error: `${NOT_A_BACKUP} It could not be read as a backup. ${NOTHING_IMPORTED}`,
    }
  }

  const head = envelope.safeParse(raw)
  if (!head.success) return { ok: false, error: `${NOT_A_BACKUP} ${NOTHING_IMPORTED}` }
  if (head.data.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup was made by a newer version of the app. Close the app and open it again to update, then try again. ${NOTHING_IMPORTED}`,
    }
  }

  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: `This backup file is damaged (${issue ? describeIssue(issue) : 'unreadable'}). ${NOTHING_IMPORTED}`,
    }
  }
  const backup = parsed.data as Backup

  for (const [name, records] of [
    ['gym', backup.userGyms],
    ['pass', backup.passes],
    ['recorded use', backup.uses],
    ['freeze', backup.freezes],
  ] as const) {
    if (firstDuplicate(records)) {
      return {
        ok: false,
        error: `This backup file is damaged (a ${name} appears twice). ${NOTHING_IMPORTED}`,
      }
    }
  }

  const passIds = new Set(backup.passes.map((p) => p.id))
  const gymIds = new Set(backup.userGyms.map((g) => g.id))
  const danglingUse = backup.uses.findIndex((u) => !passIds.has(u.passId))
  if (danglingUse >= 0) {
    return {
      ok: false,
      error: `This backup file is damaged (recorded use ${danglingUse + 1} belongs to a pass that is not in the file). ${NOTHING_IMPORTED}`,
    }
  }
  const danglingFreeze = backup.freezes.findIndex((f) => !passIds.has(f.passId))
  if (danglingFreeze >= 0) {
    return {
      ok: false,
      error: `This backup file is damaged (freeze ${danglingFreeze + 1} belongs to a pass that is not in the file). ${NOTHING_IMPORTED}`,
    }
  }
  const danglingGym = backup.passes.findIndex(
    (p) => p.gymRef.kind === 'user' && !gymIds.has(p.gymRef.id),
  )
  if (danglingGym >= 0) {
    return {
      ok: false,
      error: `This backup file is damaged (pass ${danglingGym + 1} uses a gym that is not in the file). ${NOTHING_IMPORTED}`,
    }
  }
  return { ok: true, backup }
}

// ---- Merging a backup into a device -------------------------------------------------------

export type SettingsOutcome = 'none' | 'added' | 'updated' | 'kept'

/** What importing would do, in terms a person can read. Deleted rows are not counted as "new". */
export interface ImportSummary {
  passesAdded: number
  passesUpdated: number
  passesRemoved: number
  usesAdded: number
  usesRemoved: number
  freezesChanged: number
  gymsAdded: number
  /** Gyms in the file that are the same gym, by name, as one already here, so no copy is made. */
  gymsMerged: number
  settings: SettingsOutcome
  /** True when importing would change nothing a person can see. */
  nothingNew: boolean
}

export interface ImportPlan {
  /** The rows to write; everything else on the device is left exactly as it is. */
  put: Omit<Snapshot, 'settings'> & { settings: StoredSettings | undefined }
  summary: ImportSummary
}

const time = (iso: string) => Date.parse(iso)
const newer = (incoming: { updatedAt: string }, local: { updatedAt: string }) =>
  time(incoming.updatedAt) > time(local.updatedAt)

type Change = 'added' | 'updated' | 'removed' | 'quiet' | 'unchanged'

/** What a row from the file does to the row with the same id here (last write wins). */
function classify(local: RecordMeta | undefined, incoming: RecordMeta): Change {
  if (!local) return incoming.deletedAt === null ? 'added' : 'quiet'
  if (!newer(incoming, local)) return 'unchanged'
  if (local.deletedAt === null && incoming.deletedAt !== null) return 'removed'
  if (local.deletedAt !== null && incoming.deletedAt === null) return 'added'
  if (local.deletedAt !== null) return 'quiet'
  return 'updated'
}

function mergeRecords<T extends RecordMeta>(local: T[], incoming: T[]) {
  const byId = new Map(local.map((r) => [r.id, r]))
  const put: T[] = []
  const counts: Record<Change, number> = {
    added: 0,
    updated: 0,
    removed: 0,
    quiet: 0,
    unchanged: 0,
  }
  for (const row of incoming) {
    const change = classify(byId.get(row.id), row)
    counts[change]++
    if (change !== 'unchanged') put.push(row)
  }
  return { put, counts }
}

const sameSettings = (a: Settings, b: Settings) =>
  JSON.stringify([
    a.expiryReminderDays,
    a.lowEntriesThreshold,
    a.expiryRemindersEnabled,
    a.lowRemindersEnabled,
    a.resetRemindersEnabled,
    Object.entries(a.dismissedReminders).sort(),
  ]) ===
  JSON.stringify([
    b.expiryReminderDays,
    b.lowEntriesThreshold,
    b.expiryRemindersEnabled,
    b.lowRemindersEnabled,
    b.resetRemindersEnabled,
    Object.entries(b.dismissedReminders).sort(),
  ])

/**
 * Works out how to add a backup to a device that may already have data (D38). Pure: it says what to
 * write and what that means, and the repository does the writing in one transaction.
 *
 * - Rows are matched by id. The newer edit (by `updatedAt`) wins; a tie keeps what is here.
 * - Nothing is ever deleted by importing, except a pass, use or freeze that the file has a *newer
 *   deletion* of. An older copy of something deleted here does not bring it back.
 * - A gym in the file that has the same name (ignoring case and punctuation) as a gym already
 *   here, or as a built-in gym, is the same gym: its passes are pointed at the one here and no copy
 *   is made (the rule of D24 / FR-53).
 * - Running the same import twice changes nothing the second time.
 */
export function planImport(
  local: Snapshot,
  incoming: Backup,
  builtinGyms: BuiltinGym[],
): ImportPlan {
  // Gyms
  const localGymById = new Map(local.userGyms.map((g) => [g.id, g]))
  const liveLocalByName = new Map<string, UserGym>()
  for (const gym of [...local.userGyms].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const key = normalizeGymName(gym.name)
    if (gym.deletedAt === null && !liveLocalByName.has(key)) liveLocalByName.set(key, gym)
  }
  const builtinByName = new Map(builtinGyms.map((g) => [normalizeGymName(g.name), g.id]))

  const remap = new Map<string, GymRef>()
  const gymsToPut: UserGym[] = []
  let gymsAdded = 0
  let gymsMerged = 0
  for (const gym of incoming.userGyms) {
    const existing = localGymById.get(gym.id)
    if (existing) {
      if (newer(gym, existing)) gymsToPut.push(gym)
      continue
    }
    if (gym.deletedAt === null) {
      const key = normalizeGymName(gym.name)
      const builtinId = builtinByName.get(key)
      const sameHere = liveLocalByName.get(key)
      if (builtinId) {
        remap.set(gym.id, { kind: 'builtin', id: builtinId })
        gymsMerged++
        continue
      }
      if (sameHere) {
        remap.set(gym.id, { kind: 'user', id: sameHere.id })
        gymsMerged++
        continue
      }
      liveLocalByName.set(key, gym)
      gymsAdded++
    }
    gymsToPut.push(gym)
  }

  const remapRef = (ref: GymRef): GymRef => (ref.kind === 'user' ? (remap.get(ref.id) ?? ref) : ref)

  const passes = mergeRecords(
    local.passes,
    incoming.passes.map((p): Pass => ({ ...p, gymRef: remapRef(p.gymRef) })),
  )
  const uses = mergeRecords(local.uses, incoming.uses)
  const freezes = mergeRecords(local.freezes, incoming.freezes)

  let settings: StoredSettings | undefined
  let settingsOutcome: SettingsOutcome = 'none'
  if (incoming.settings) {
    if (!local.settings) {
      settings = incoming.settings
      settingsOutcome = 'added'
    } else if (newer(incoming.settings, local.settings)) {
      if (sameSettings(incoming.settings, local.settings)) {
        settingsOutcome = 'kept'
      } else {
        settings = incoming.settings
        settingsOutcome = 'updated'
      }
    } else {
      settingsOutcome = 'kept'
    }
  }

  const summary: ImportSummary = {
    passesAdded: passes.counts.added,
    passesUpdated: passes.counts.updated,
    passesRemoved: passes.counts.removed,
    usesAdded: uses.counts.added,
    usesRemoved: uses.counts.removed,
    freezesChanged: freezes.counts.added + freezes.counts.updated + freezes.counts.removed,
    gymsAdded,
    gymsMerged,
    settings: settingsOutcome,
    nothingNew: false,
  }
  summary.nothingNew =
    summary.passesAdded +
      summary.passesUpdated +
      summary.passesRemoved +
      summary.usesAdded +
      summary.usesRemoved +
      summary.freezesChanged +
      summary.gymsAdded ===
      0 &&
    summary.settings !== 'added' &&
    summary.settings !== 'updated'

  return {
    put: {
      userGyms: gymsToPut,
      passes: passes.put,
      uses: uses.put,
      freezes: freezes.put,
      settings,
    },
    summary,
  }
}
