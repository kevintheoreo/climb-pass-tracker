// Builders for domain tests. Not used by app code.
import type { Freeze, MembershipPass, MonthlyMembership, PassBundle, Use } from './types'
import type { Pass } from './types'

type Multi = Extract<Pass, { passType: 'multipass' | 'class_pack' }>
type Single = Extract<Pass, { passType: 'single_entry' }>

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

const meta = (prefix: string) => ({
  id: nextId(prefix),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
})

/** A local-time timestamp on `date` (`YYYY-MM-DD`), so its local calendar day is `date` anywhere. */
export function at(date: string, hour = 12): string {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
  ).toISOString()
}

const common = () => ({
  gymRef: { kind: 'builtin', id: 'gym-a' } as const,
  priceCents: null,
  comments: null,
  purchaseDate: '2026-01-01',
})

/** A 10-entry multipass bought 2026-01-01, expiring 2026-12-31. */
export function makeCounted(overrides: Partial<Multi> = {}): Multi {
  return {
    ...meta('pass'),
    ...common(),
    passType: 'multipass',
    totalEntries: 10,
    initialUsed: 0,
    expiryDate: '2026-12-31',
    ...overrides,
  }
}

export function makeSingle(overrides: Partial<Single> = {}): Single {
  return {
    ...meta('pass'),
    ...common(),
    passType: 'single_entry',
    totalEntries: 1,
    initialUsed: 0,
    expiryDate: null,
    ...overrides,
  }
}

/** An unlimited membership, 2026-10-01 to 2026-10-31. */
export function makeMembership(overrides: Partial<MembershipPass> = {}): MembershipPass {
  return {
    ...meta('pass'),
    ...common(),
    passType: 'membership',
    purchaseDate: '2026-10-01',
    expiryDate: '2026-10-31',
    monthlyEntries: null,
    resetDay: null,
    ...overrides,
  }
}

/** A membership with 8 entries per month, 2026-10-10 to 2027-10-09, resetting on the 10th. */
export function makeMonthly(overrides: Partial<MonthlyMembership> = {}): MonthlyMembership {
  return makeMembership({
    purchaseDate: '2026-10-10',
    expiryDate: '2027-10-09',
    monthlyEntries: 8,
    ...overrides,
  }) as MonthlyMembership
}

export function makeUse(passId: string, overrides: Partial<Use> = {}): Use {
  return { ...meta('use'), passId, usedAt: at('2026-06-01'), ...overrides }
}

/** `count` uses, all on `date`. */
export function makeUses(passId: string, count: number, date = '2026-06-01'): Use[] {
  return Array.from({ length: count }, () => makeUse(passId, { usedAt: at(date) }))
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
