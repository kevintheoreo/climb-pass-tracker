import Dexie, { type EntityTable } from 'dexie'
import type { Settings } from '../domain/settings'
import type { Freeze, Pass, Use, UserGym } from '../domain/types'

export interface SettingsRow extends Settings {
  id: 'settings'
  updatedAt: string
}

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * On-device IndexedDB database. Every user-owned table uses client-generated string ids. Deleting a
 * pass removes it for good; removing a use (`+`), a freeze or a user gym only flags it
 * (`deletedAt`) so a backup can carry the removal. `null` is not a valid IndexedDB key,
 * so `deletedAt` is deliberately not indexed: filter live rows in code (see the repository).
 */
export class ClimbDB extends Dexie {
  // `declare` (not a field initialiser) so Dexie's table accessors aren't overwritten.
  declare passes: EntityTable<Pass, 'id'>
  declare uses: EntityTable<Use, 'id'>
  declare freezes: EntityTable<Freeze, 'id'>
  declare userGyms: EntityTable<UserGym, 'id'>
  declare settings: EntityTable<SettingsRow, 'id'>
  declare meta: EntityTable<MetaRow, 'key'>

  constructor(name = 'climb-pass-tracker') {
    super(name)

    // Version 1 belonged to the earlier multi-screen design. Kept so Dexie can upgrade from it.
    this.version(1).stores({
      passes: 'id, updatedAt, passType, gymRef.id',
      uses: 'id, passId, usedAt, updatedAt',
      freezes: 'id, passId, updatedAt',
      userGyms: 'id, updatedAt',
      userTemplates: 'id, gymRef.id, updatedAt',
      hiddenGyms: 'id, updatedAt',
      settings: 'id',
      meta: 'key',
    })

    // Version 2: the single-screen design. Pass templates and hidden gyms are gone, and the pass
    // shape changed (no name, one purchase / expiry date for every type, monthly memberships), so
    // the old pass, use and freeze rows are cleared. Nothing had launched, so the only rows that
    // existed were development test data. User gyms and settings are kept.
    this.version(2)
      .stores({
        passes: 'id, updatedAt, passType, gymRef.id',
        uses: 'id, passId, usedAt, updatedAt',
        freezes: 'id, passId, updatedAt',
        userGyms: 'id, updatedAt',
        userTemplates: null,
        hiddenGyms: null,
        settings: 'id',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table('passes').clear(),
          tx.table('uses').clear(),
          tx.table('freezes').clear(),
        ])
      })

    // Version 3: deleting a pass now removes it for good. Passes that were only flagged deleted
    // before are purged here, with every use and freeze that belonged to them (or to no pass).
    this.version(3)
      .stores({
        passes: 'id, updatedAt, passType, gymRef.id',
        uses: 'id, passId, usedAt, updatedAt',
        freezes: 'id, passId, updatedAt',
        userGyms: 'id, updatedAt',
        settings: 'id',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const passes = await tx.table('passes').toArray()
        const live = new Set(passes.filter((p) => p.deletedAt == null).map((p) => p.id))
        await tx
          .table('passes')
          .filter((p) => p.deletedAt != null)
          .delete()
        await tx
          .table('uses')
          .filter((u) => !live.has(u.passId))
          .delete()
        await tx
          .table('freezes')
          .filter((f) => !live.has(f.passId))
          .delete()
      })
  }
}

export const db = new ClimbDB()
