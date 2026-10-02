import type { BuiltinGym } from '../domain/gyms'

/**
 * The built-in gym list: gym NAMES ONLY (PRD D11). No pass options, prices or validity periods —
 * people enter their own on each row. Ids are fixed forever: milestone 2 loads the same rows into
 * the database, so passes created now must keep pointing at the same gym.
 *
 * !! PLACEHOLDER DATA !!  These sample gyms are NOT real. Before launch, replace them with the
 * checked Singapore gym list (PRD section 11 and step 3.1 of the implementation plan): confirm each
 * gym's name against its website or front desk. Gyms are tracked per brand; an outlet with
 * different pricing is typed as its own gym name (D10).
 */
export const BUILTIN_GYMS: BuiltinGym[] = [
  { id: '0859db82-c520-4f55-8b0a-0e7362d8f2fe', name: 'Sample Boulder Gym (placeholder)' },
  { id: 'aad09cb6-fb53-401f-879a-caa3db961169', name: 'Sample Climbing Gym (placeholder)' },
]
