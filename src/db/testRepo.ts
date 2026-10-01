// Test helper: a repository on a throwaway in-memory database with a controllable clock and ids.
import { ClimbDB } from './db'
import { createRepo } from './repo'

let dbCounter = 0

export function makeTestRepo() {
  let tick = 0
  let idCounter = 0
  const db = new ClimbDB(`test-db-${++dbCounter}`)
  const repo = createRepo(db, {
    // Each call is one second later, so "updated after created" is always visible.
    now: () => new Date(Date.UTC(2026, 9, 1, 0, 0, tick++)).toISOString(),
    newId: () => `id-${++idCounter}`,
  })
  return { db, repo, clock: () => new Date(Date.UTC(2026, 9, 1, 0, 0, tick)).toISOString() }
}
