// Test helper: a repository on a throwaway in-memory database with a controllable clock and ids.
import type { BuiltinGym } from '../domain/gyms'
import { ClimbDB } from './db'
import { createRepo } from './repo'

let dbCounter = 0

export const TEST_BUILTIN_GYMS: BuiltinGym[] = [
  { id: 'b-fitbloc', name: 'Fit Bloc' },
  { id: 'b-plus', name: 'Boulder+' },
]

export function makeTestRepo() {
  let tick = 0
  let idCounter = 0
  const db = new ClimbDB(`test-db-${++dbCounter}`)
  const repo = createRepo(db, {
    // Each call is one second later, so "updated after created" is always visible.
    now: () => new Date(Date.UTC(2026, 9, 1, 0, 0, tick++)).toISOString(),
    newId: () => `id-${++idCounter}`,
    builtinGyms: TEST_BUILTIN_GYMS,
  })
  return { db, repo }
}
