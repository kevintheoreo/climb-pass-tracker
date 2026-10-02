import type { FreezeInput, PassInput, UseInput, UserGymInput } from './schemas'

export type { FreezeInput, GymRef, PassInput, UseInput, UserGymInput } from './schemas'

/** Fields on every user-owned record. Deletes are soft (`deletedAt` set) so they can sync. */
export interface RecordMeta {
  id: string
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Pass = PassInput & RecordMeta
export type Use = UseInput & RecordMeta
export type Freeze = FreezeInput & RecordMeta
export type UserGym = UserGymInput & RecordMeta

export type PassType = Pass['passType']
export type MembershipPass = Extract<Pass, { passType: 'membership' }>
/** Multipass, class pack and single entry: passes with a fixed total of entries. */
export type CountedPass = Exclude<Pass, MembershipPass>
/** A membership with an entries-per-month allowance (D32). */
export type MonthlyMembership = MembershipPass & { monthlyEntries: number }

/** A pass together with its uses and freezes, as the screens load them. */
export interface PassBundle {
  pass: Pass
  uses: Use[]
  freezes: Freeze[]
}

export function isCounted(pass: Pass): pass is CountedPass {
  return pass.passType !== 'membership'
}

export function isMembership(pass: Pass): pass is MembershipPass {
  return pass.passType === 'membership'
}

export function isMonthly(pass: Pass): pass is MonthlyMembership {
  return pass.passType === 'membership' && pass.monthlyEntries !== null
}

/** A pass's fields before its gym is known (the gym cell's text is turned into a gym on save). */
export type PassFields = PassInput extends infer P
  ? P extends unknown
    ? Omit<P, 'gymRef'>
    : never
  : never
