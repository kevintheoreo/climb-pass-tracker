import type { GymRef, UserGym } from './types'

/**
 * A built-in gym: a name and nothing else. No pass options, prices or validity periods (D11) —
 * people enter their own on each row.
 */
export interface BuiltinGym {
  /** Fixed id, shared with the database in milestone 2. Never change it once released. */
  id: string
  name: string
  /**
   * False retires the gym: it is no longer suggested in the gym box, but passes that already use
   * it keep showing its name. Never remove a gym from the list instead.
   */
  isActive: boolean
}

/** A gym as shown in the autocomplete: built-in and user-added gyms in one shape. */
export interface GymEntry {
  ref: GymRef
  name: string
  /** Whether the gym is suggested in the gym box; a retired gym still names its old passes. */
  isActive: boolean
}

const byName = (a: GymEntry, b: GymEntry) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.ref.id < b.ref.id ? -1 : 1)

/** Every gym, built-in and user-added, sorted by name ignoring case. */
export function buildGymList(builtin: BuiltinGym[], userGyms: UserGym[]): GymEntry[] {
  return [
    ...builtin.map((g): GymEntry => ({
      ref: { kind: 'builtin', id: g.id },
      name: g.name,
      isActive: g.isActive,
    })),
    ...userGyms
      .filter((g) => g.deletedAt === null)
      .map((g): GymEntry => ({ ref: { kind: 'user', id: g.id }, name: g.name, isActive: true })),
  ].sort(byName)
}

export function findGym(gyms: GymEntry[], ref: GymRef): GymEntry | undefined {
  return gyms.find((g) => g.ref.kind === ref.kind && g.ref.id === ref.id)
}

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * A gym name with case, punctuation and spacing all ignored; "+" counts as "plus". So "Fitbloc",
 * "fit bloc" and "fit·bloc" are the same gym, and so are "Climb@T3" and "climb t3".
 */
export function normalizeGymName(name: string): string {
  return tokens(name).join('')
}

/** What gets saved for a new gym: trimmed, with runs of spaces collapsed. */
export function cleanGymName(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ')
}

/**
 * Active gyms whose name contains every word typed, ignoring case, punctuation and spacing
 * ("boulder+" works, and so does "fitbloc" for "fit·bloc"). Retired gyms are never suggested.
 */
export function searchGyms(gyms: GymEntry[], query: string): GymEntry[] {
  const wanted = tokens(query)
  const active = gyms.filter((g) => g.isActive)
  if (wanted.length === 0) return active
  return active.filter((g) => {
    const name = normalizeGymName(g.name)
    return wanted.every((w) => name.includes(w))
  })
}

export type GymChoice =
  { kind: 'existing'; gym: GymEntry } | { kind: 'new'; name: string } | { kind: 'empty' }

/**
 * What the text in a row's gym cell means (D24, FR-25, FR-53): an existing gym when the text equals
 * one ignoring case and punctuation (active gyms, then built-in gyms, win a tie), otherwise a new
 * gym to create, or nothing when there is no usable text. A retired gym still matches, so typing
 * its exact name does not create a duplicate.
 */
export function resolveGymInput(typed: string, gyms: GymEntry[]): GymChoice {
  const name = cleanGymName(typed)
  const wanted = normalizeGymName(name)
  if (wanted === '') return { kind: 'empty' }
  const matches = gyms.filter((g) => normalizeGymName(g.name) === wanted)
  const existing =
    matches.find((g) => g.isActive && g.ref.kind === 'builtin') ??
    matches.find((g) => g.isActive) ??
    matches.find((g) => g.ref.kind === 'builtin') ??
    matches[0]
  return existing ? { kind: 'existing', gym: existing } : { kind: 'new', name }
}
