import { BILLING_PERIOD_LABELS, PASS_TYPE_LABELS, type BillingPeriod } from './labels'
import { formatSgd } from './money'
import { getPassStatus } from './passStatus'
import type { LocalDate } from './dates'
import type { Settings } from './settings'
import type { GymRef, PassBundle, PassType, UserGym, UserTemplate } from './types'

/**
 * A built-in gym: name, optional website and pass options only. There are deliberately no
 * prices or validity periods here (D11) — people enter their own.
 */
export interface BuiltinGym {
  /** Fixed id, shared with the database in milestone 2. Never change it once released. */
  id: string
  name: string
  website: string | null
  templates: BuiltinTemplate[]
}

export interface BuiltinTemplate {
  id: string
  passType: PassType
  name: string
  /** Counted types (multipass, class pack) only. */
  entries: number | null
  /** Memberships only. */
  billingPeriod: BillingPeriod | null
}

/** A pass option, from the built-in list or saved by the user. */
export interface GymTemplate {
  id: string
  source: 'builtin' | 'user'
  passType: PassType
  name: string
  totalEntries: number | null
  billingPeriod: BillingPeriod | null
  /** Only ever set on templates the user saved themselves (Q3). */
  priceCents: number | null
  validityMonths: number | null
  /** The user's own notes. Only on templates the user saved. */
  comments: string | null
}

/** A gym as shown to the user: built-in and user-added gyms in one shape. */
export interface GymEntry {
  ref: GymRef
  name: string
  website: string | null
  templates: GymTemplate[]
}

export interface GymSources {
  builtin: BuiltinGym[]
  userGyms: UserGym[]
  userTemplates: UserTemplate[]
  hiddenGymIds: string[]
}

const byName = (a: GymEntry, b: GymEntry) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.ref.id < b.ref.id ? -1 : 1)

const fromUserTemplate = (t: UserTemplate): GymTemplate => ({
  id: t.id,
  source: 'user',
  passType: t.passType,
  // User options have no name of their own: the type is the name.
  name: PASS_TYPE_LABELS[t.passType],
  totalEntries: t.totalEntries,
  billingPeriod: t.billingPeriod,
  priceCents: t.priceCents,
  validityMonths: t.validityMonths,
  // Rows saved before comments existed have none.
  comments: t.comments ?? null,
})

/**
 * Every gym, built-in and user-added, sorted by name, each with its pass options (built-in ones
 * first, then the user's own). Hidden built-in gyms are left out unless `includeHidden` is set or
 * the gym id is in `keepVisibleIds` (e.g. gyms the user still holds passes at).
 */
export function buildGymList(
  sources: GymSources,
  options: { includeHidden?: boolean; keepVisibleIds?: Iterable<string> } = {},
): GymEntry[] {
  const hidden = new Set(sources.hiddenGymIds)
  const keep = new Set(options.keepVisibleIds ?? [])

  const userTemplatesFor = (ref: GymRef) =>
    sources.userTemplates
      .filter((t) => t.deletedAt === null && t.gymRef.kind === ref.kind && t.gymRef.id === ref.id)
      .sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1,
      )
      .map(fromUserTemplate)

  const builtin: GymEntry[] = sources.builtin
    .filter((g) => options.includeHidden || !hidden.has(g.id) || keep.has(g.id))
    .map((g) => {
      const ref: GymRef = { kind: 'builtin', id: g.id }
      return {
        ref,
        name: g.name,
        website: g.website,
        templates: [
          ...g.templates.map((t): GymTemplate => ({
            id: t.id,
            source: 'builtin',
            passType: t.passType,
            name: t.name,
            totalEntries: t.entries,
            billingPeriod: t.billingPeriod,
            priceCents: null,
            validityMonths: null,
            comments: null,
          })),
          ...userTemplatesFor(ref),
        ],
      }
    })

  const user: GymEntry[] = sources.userGyms
    .filter((g) => g.deletedAt === null)
    .map((g) => {
      const ref: GymRef = { kind: 'user', id: g.id }
      return { ref, name: g.name, website: g.website, templates: userTemplatesFor(ref) }
    })

  return [...builtin, ...user].sort(byName)
}

export function findGym(gyms: GymEntry[], ref: GymRef): GymEntry | undefined {
  return gyms.find((g) => g.ref.kind === ref.kind && g.ref.id === ref.id)
}

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Gyms whose name contains every word typed, ignoring case and punctuation ("boulder+" works). */
export function searchGyms(gyms: GymEntry[], query: string): GymEntry[] {
  const wanted = tokens(query)
  if (wanted.length === 0) return gyms
  return gyms.filter((g) => {
    const name = tokens(g.name).join(' ')
    return wanted.every((w) => name.includes(w))
  })
}

/**
 * How many active passes the user has at each gym, keyed by gym id (FR-27). Active means it
 * belongs on the dashboard: counted passes with entries left and not expired, memberships that
 * haven't ended (including frozen ones). Used-up, expired and single-entry passes don't count.
 */
export function countActivePassesByGym(
  bundles: PassBundle[],
  today: LocalDate,
  settings: Pick<Settings, 'expiryReminderDays' | 'lowEntriesThreshold'>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { pass, uses, freezes } of bundles) {
    if (pass.deletedAt !== null) continue
    if (!getPassStatus(pass, uses, freezes, today, settings).isActive) continue
    counts[pass.gymRef.id] = (counts[pass.gymRef.id] ?? 0) + 1
  }
  return counts
}

function describeParts(t: GymTemplate): string[] {
  const parts: string[] = []
  if (t.passType === 'multipass' && t.totalEntries !== null) {
    parts.push(t.totalEntries === 1 ? '1 entry' : `${t.totalEntries} entries`)
  } else if (t.passType === 'class_pack' && t.totalEntries !== null) {
    parts.push(t.totalEntries === 1 ? '1 session' : `${t.totalEntries} sessions`)
  } else if (t.passType === 'membership') {
    parts.push(t.billingPeriod ? BILLING_PERIOD_LABELS[t.billingPeriod] : 'Membership')
  } else if (t.passType === 'single_entry') {
    parts.push('Single entry')
  }
  if (t.validityMonths !== null) {
    parts.push(t.validityMonths === 1 ? '1 month' : `${t.validityMonths} months`)
  }
  return parts
}

/** Short description of a pass option: "10 entries", "Monthly", plus validity if saved. */
export function describeTemplate(t: GymTemplate): string {
  return describeParts(t).join(' · ')
}

/**
 * The detail line under a pass option's name, as separate parts: the type (for built-in options,
 * whose names are the gym's own), what it is, validity and price. Parts that only repeat the name
 * are dropped, so a user's "Single entry" option doesn't read "Single entry · Single entry".
 */
export function templateDetails(t: GymTemplate): string[] {
  const parts = [
    ...(t.source === 'builtin' ? [PASS_TYPE_LABELS[t.passType]] : []),
    ...describeParts(t),
    ...(t.priceCents !== null ? [formatSgd(t.priceCents)] : []),
  ]
  return parts.filter((part, i) => part !== t.name && parts.indexOf(part) === i)
}

/** Turns what someone types into a web address: empty → null, bare `example.com` → https. */
export function normalizeWebsite(input: string): string | null {
  const text = input.trim()
  if (text === '') return null
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
}
