// Builders for domain tests. Not used by app code.
import type { CountedPass, Freeze, MembershipPass, PassBundle, SingleEntryPass, Use } from './types'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

const meta = (prefix: string) => ({
  id: nextId(prefix),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
})

export function makeCounted(overrides: Partial<CountedPass> = {}): CountedPass {
  return {
    ...meta('pass'),
    gymRef: { kind: 'builtin', id: 'gym-a' },
    passType: 'multipass',
    name: '10-Pass',
    priceCents: null,
    notes: null,
    totalEntries: 10,
    initialUsed: 0,
    purchaseDate: '2026-01-01',
    expiryDate: '2026-12-31',
    ...overrides,
  }
}

export function makeMembership(overrides: Partial<MembershipPass> = {}): MembershipPass {
  return {
    ...meta('pass'),
    gymRef: { kind: 'builtin', id: 'gym-a' },
    passType: 'membership',
    name: 'Monthly',
    priceCents: null,
    notes: null,
    billingPeriod: 'monthly',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    ...overrides,
  }
}

export function makeSingle(overrides: Partial<SingleEntryPass> = {}): SingleEntryPass {
  return {
    ...meta('pass'),
    gymRef: { kind: 'builtin', id: 'gym-a' },
    passType: 'single_entry',
    name: 'Day pass',
    priceCents: null,
    notes: null,
    visitDate: '2026-10-01',
    ...overrides,
  }
}

export function makeUse(passId: string, overrides: Partial<Use> = {}): Use {
  return { ...meta('use'), passId, usedAt: '2026-06-01T12:00:00.000Z', note: null, ...overrides }
}

export function makeUses(passId: string, count: number): Use[] {
  return Array.from({ length: count }, () => makeUse(passId))
}

export function makeFreeze(passId: string, startDate: string, endDate: string): Freeze {
  return { ...meta('freeze'), passId, startDate, endDate }
}

export function bundle(
  pass: PassBundle['pass'],
  { uses = [], freezes = [] }: { uses?: Use[]; freezes?: Freeze[] } = {},
): PassBundle {
  return { pass, uses, freezes }
}
