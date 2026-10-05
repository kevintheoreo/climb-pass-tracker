// Test helper: a repository on a throwaway in-memory database with a controllable clock and ids.
import type { BuiltinGym } from '../domain/gyms'
import { ClimbDB } from './db'
import { createRepo } from './repo'

let dbCounter = 0

export const TEST_BUILTIN_GYMS: BuiltinGym[] = [
  { id: 'b-fitbloc', name: 'Fit Bloc', isActive: true },
  { id: 'b-plus', name: 'Boulder+', isActive: true },
]

/**
 * A repository on a throwaway database. Ids are `id-1`, `id-2`, ... unless `idPrefix` says
 * otherwise (give two repos different prefixes when they stand for two devices). The clock starts at
 * `startSecond` seconds past 2026-10-01 and moves one second per call, or is `now` if given.
 */
export function makeTestRepo(
  options: { idPrefix?: string; startSecond?: number; now?: () => string } = {},
) {
  let tick = options.startSecond ?? 0
  let idCounter = 0
  const db = new ClimbDB(`test-db-${++dbCounter}`)
  const repo = createRepo(db, {
    // Each call is one second later, so "updated after created" is always visible.
    now: options.now ?? (() => new Date(Date.UTC(2026, 9, 1, 0, 0, tick++)).toISOString()),
    newId: () => `${options.idPrefix ?? 'id'}-${++idCounter}`,
    builtinGyms: TEST_BUILTIN_GYMS,
  })
  return { db, repo }
}
