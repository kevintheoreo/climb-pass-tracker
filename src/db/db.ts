import Dexie, { type EntityTable } from 'dexie'
import type { Settings } from '../domain/settings'
import type { Freeze, HiddenGym, Pass, Use, UserGym, UserTemplate } from '../domain/types'

export interface SettingsRow extends Settings {
  id: 'settings'
  updatedAt: string
}

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * On-device IndexedDB database. Every user-owned table uses client-generated string ids and soft
 * deletes (`deletedAt`), so the same rows can be synced later. `null` is not a valid IndexedDB key,
 * so `deletedAt` is deliberately not indexed: filter live rows in code (see the repository).
 */
export class ClimbDB extends Dexie {
  // `declare` (not a field initialiser) so Dexie's table accessors aren't overwritten.
  declare passes: EntityTable<Pass, 'id'>
  declare uses: EntityTable<Use, 'id'>
  declare freezes: EntityTable<Freeze, 'id'>
  declare userGyms: EntityTable<UserGym, 'id'>
  declare userTemplates: EntityTable<UserTemplate, 'id'>
  declare hiddenGyms: EntityTable<HiddenGym, 'id'>
  declare settings: EntityTable<SettingsRow, 'id'>
  declare meta: EntityTable<MetaRow, 'key'>

  constructor(name = 'climb-pass-tracker') {
    super(name)
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
  }
}

export const db = new ClimbDB()
