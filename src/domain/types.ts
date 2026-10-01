import type { FreezeInput, PassInput, UseInput, UserGymInput, UserTemplateInput } from './schemas'

export type {
  FreezeInput,
  GymRef,
  PassInput,
  UseInput,
  UserGymInput,
  UserTemplateInput,
} from './schemas'

/** Fields on every user-owned record. Deletes are soft (`deletedAt` set) so they can sync later. */
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
export type UserTemplate = UserTemplateInput & RecordMeta
/** A built-in gym the user has hidden from the picker. `id` is the built-in gym's id. */
export type HiddenGym = RecordMeta

export type PassType = Pass['passType']
export type CountedPass = Extract<Pass, { passType: 'multipass' | 'class_pack' }>
export type MembershipPass = Extract<Pass, { passType: 'membership' }>
export type SingleEntryPass = Extract<Pass, { passType: 'single_entry' }>

/** A pass together with its uses and freezes, as the screens load them. */
export interface PassBundle {
  pass: Pass
  uses: Use[]
  freezes: Freeze[]
}

export function isCounted(pass: Pass): pass is CountedPass {
  return pass.passType === 'multipass' || pass.passType === 'class_pack'
}

export function isMembership(pass: Pass): pass is MembershipPass {
  return pass.passType === 'membership'
}
