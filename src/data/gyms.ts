import type { BuiltinGym } from '../domain/gyms'

/**
 * The built-in gym list: gym names and pass options only. NO prices and NO validity periods
 * (PRD D11) — people enter their own. Ids are fixed forever: milestone 2 loads the same rows into
 * the database, so passes created now must keep pointing at the same gym.
 *
 * !! PLACEHOLDER DATA !!  These sample gyms are NOT real. Before launch, replace them with the
 * checked Singapore gym list (PRD section 11 and step 3.1 of the implementation plan): confirm each
 * gym's name and what it sells (type and number of entries) against its website or front desk.
 * Pass options are per brand; an outlet with different pricing is listed as its own gym (D10).
 */
export const BUILTIN_GYMS: BuiltinGym[] = [
  {
    id: '0859db82-c520-4f55-8b0a-0e7362d8f2fe',
    name: 'Sample Boulder Gym (placeholder)',
    website: null,
    templates: [
      {
        id: '9373a5f9-d952-423c-bb50-6345c79c779f',
        passType: 'multipass',
        name: '10-Pass',
        entries: 10,
        billingPeriod: null,
      },
      {
        id: 'fa70f169-d138-40ae-b1f3-7c1d57b3bb47',
        passType: 'multipass',
        name: '20-Pass',
        entries: 20,
        billingPeriod: null,
      },
      {
        id: '3977ab55-d565-4e7e-a1ac-2d7d509dedd2',
        passType: 'single_entry',
        name: 'Day pass',
        entries: null,
        billingPeriod: null,
      },
    ],
  },
  {
    id: 'aad09cb6-fb53-401f-879a-caa3db961169',
    name: 'Sample Climbing Gym (placeholder)',
    website: null,
    templates: [
      {
        id: '798d5a99-e218-4c73-ac4e-5f8ffbed3046',
        passType: 'membership',
        name: 'Monthly membership',
        entries: null,
        billingPeriod: 'monthly',
      },
      {
        id: '9d025e8d-bb55-44d4-8ae3-39ed940315c5',
        passType: 'class_pack',
        name: 'Beginner course',
        entries: 4,
        billingPeriod: null,
      },
    ],
  },
]
