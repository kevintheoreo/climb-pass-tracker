import { DEFAULT_SETTINGS } from './settings'
import {
  buildGymList,
  countActivePassesByGym,
  describeTemplate,
  findGym,
  normalizeWebsite,
  searchGyms,
  templateDetails,
  type BuiltinGym,
  type GymSources,
  type GymTemplate,
} from './gyms'
import {
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeSingle,
  makeUses,
} from './testFactories'
import type { UserGym, UserTemplate } from './types'

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}

const builtin: BuiltinGym[] = [
  {
    id: 'b-planet',
    name: 'Boulder Planet',
    website: null,
    templates: [
      { id: 't1', passType: 'multipass', name: '10-Pass', entries: 10, billingPeriod: null },
    ],
  },
  { id: 'b-plus', name: 'Boulder+', website: null, templates: [] },
  { id: 'b-fit', name: 'fit bloc', website: null, templates: [] },
]

const userGym = (id: string, name: string, overrides: Partial<UserGym> = {}): UserGym => ({
  id,
  name,
  website: null,
  ...meta,
  ...overrides,
})
const userTemplate = (
  id: string,
  gymRef: UserTemplate['gymRef'],
  overrides: Partial<UserTemplate> = {},
): UserTemplate => ({
  id,
  gymRef,
  passType: 'multipass',
  totalEntries: 5,
  priceCents: 7500,
  validityMonths: 6,
  billingPeriod: null,
  comments: null,
  ...meta,
  ...overrides,
})

const sources = (overrides: Partial<GymSources> = {}): GymSources => ({
  builtin,
  userGyms: [],
  userTemplates: [],
  hiddenGymIds: [],
  ...overrides,
})

const names = (gyms: { name: string }[]) => gyms.map((g) => g.name)

describe('buildGymList', () => {
  it('merges built-in and user gyms, sorted by name ignoring case', () => {
    const gyms = buildGymList(
      sources({ userGyms: [userGym('u1', 'Alpha Wall'), userGym('u2', 'zeta')] }),
    )
    expect(names(gyms)).toEqual(['Alpha Wall', 'Boulder Planet', 'Boulder+', 'fit bloc', 'zeta'])
    expect(gyms[0]?.ref).toEqual({ kind: 'user', id: 'u1' })
    expect(gyms[1]?.ref).toEqual({ kind: 'builtin', id: 'b-planet' })
  })

  it('built-in templates carry no price or validity', () => {
    const [planet] = buildGymList(sources()).filter((g) => g.name === 'Boulder Planet')
    expect(planet?.templates).toEqual([
      {
        id: 't1',
        source: 'builtin',
        passType: 'multipass',
        name: '10-Pass',
        totalEntries: 10,
        billingPeriod: null,
        priceCents: null,
        validityMonths: null,
        comments: null,
      },
    ])
  })

  it("adds the user's own templates after the built-in ones, including on built-in gyms", () => {
    const gyms = buildGymList(
      sources({
        userGyms: [userGym('u1', 'My Wall')],
        userTemplates: [
          userTemplate(
            'ut2',
            { kind: 'builtin', id: 'b-planet' },
            { comments: 'Second', createdAt: '2026-03-01T00:00:00.000Z' },
          ),
          userTemplate('ut1', { kind: 'builtin', id: 'b-planet' }, { comments: 'First' }),
          userTemplate('ut3', { kind: 'user', id: 'u1' }, { comments: 'Wall pack' }),
          userTemplate('ut4', { kind: 'builtin', id: 'u1' }, { comments: 'Wrong kind' }),
          userTemplate(
            'ut5',
            { kind: 'user', id: 'u1' },
            { comments: 'Deleted', deletedAt: '2026-02-01T00:00:00.000Z' },
          ),
        ],
      }),
    )
    const planet = gyms.find((g) => g.name === 'Boulder Planet')!
    expect(planet.templates.map((t) => `${t.source}:${t.comments ?? t.name}`)).toEqual([
      'builtin:10-Pass',
      'user:First',
      'user:Second',
    ])
    expect(planet.templates[1]).toMatchObject({ priceCents: 7500, validityMonths: 6 })
    expect(gyms.find((g) => g.name === 'My Wall')!.templates.map((t) => t.comments)).toEqual([
      'Wall pack',
    ])
  })

  it("names a user's own option after its type, and passes their comments through", () => {
    const ref = { kind: 'user', id: 'u1' } as const
    const types = ['multipass', 'class_pack', 'membership', 'single_entry'] as const
    const gyms = buildGymList(
      sources({
        userGyms: [userGym('u1', 'My Wall')],
        userTemplates: types.map((passType, i) =>
          userTemplate(`ut${i}`, ref, { passType, comments: `note ${i}` }),
        ),
      }),
    )
    const mine = gyms.find((g) => g.name === 'My Wall')!.templates
    expect(mine.map((t) => t.name)).toEqual([
      'Multipass',
      'Class / course pack',
      'Membership',
      'Single entry',
    ])
    expect(mine.map((t) => t.comments)).toEqual(['note 0', 'note 1', 'note 2', 'note 3'])
  })

  it('treats options saved before comments existed as having none', () => {
    const legacy = { ...userTemplate('old', { kind: 'user', id: 'u1' }) } as Partial<UserTemplate>
    delete legacy.comments
    const gyms = buildGymList(
      sources({
        userGyms: [userGym('u1', 'My Wall')],
        userTemplates: [legacy as UserTemplate],
      }),
    )
    expect(gyms.find((g) => g.name === 'My Wall')!.templates[0]?.comments).toBeNull()
  })

  it('leaves out deleted user gyms', () => {
    const gyms = buildGymList(
      sources({ userGyms: [userGym('u1', 'Gone', { deletedAt: '2026-02-01T00:00:00.000Z' })] }),
    )
    expect(names(gyms)).not.toContain('Gone')
  })

  it('hides hidden built-in gyms unless asked to include them or keep them visible', () => {
    const hiddenGymIds = ['b-planet']
    expect(names(buildGymList(sources({ hiddenGymIds })))).toEqual(['Boulder+', 'fit bloc'])
    expect(names(buildGymList(sources({ hiddenGymIds }), { includeHidden: true }))).toHaveLength(3)
    expect(
      names(buildGymList(sources({ hiddenGymIds }), { keepVisibleIds: ['b-planet'] })),
    ).toContain('Boulder Planet')
  })

  it('never hides a user gym', () => {
    expect(
      names(buildGymList(sources({ userGyms: [userGym('u1', 'Mine')], hiddenGymIds: ['u1'] }))),
    ).toContain('Mine')
  })
})

describe('findGym', () => {
  it('matches on both kind and id', () => {
    const gyms = buildGymList(sources({ userGyms: [userGym('b-planet', 'Same id, user gym')] }))
    expect(findGym(gyms, { kind: 'builtin', id: 'b-planet' })?.name).toBe('Boulder Planet')
    expect(findGym(gyms, { kind: 'user', id: 'b-planet' })?.name).toBe('Same id, user gym')
    expect(findGym(gyms, { kind: 'user', id: 'nope' })).toBeUndefined()
  })
})

describe('searchGyms', () => {
  const gyms = buildGymList(sources({ userGyms: [userGym('u1', 'The Climbing Depot')] }))

  it('returns everything for an empty query', () => {
    expect(searchGyms(gyms, '')).toEqual(gyms)
    expect(searchGyms(gyms, '   ')).toEqual(gyms)
  })

  it('ignores case and matches parts of the name', () => {
    expect(names(searchGyms(gyms, 'PLANET'))).toEqual(['Boulder Planet'])
    expect(names(searchGyms(gyms, 'plan'))).toEqual(['Boulder Planet'])
    expect(names(searchGyms(gyms, 'depot climbing'))).toEqual(['The Climbing Depot'])
  })

  it('treats "+" as "plus" so typing the symbol or the word both work', () => {
    expect(names(searchGyms(gyms, 'boulder+'))).toEqual(['Boulder+'])
    expect(names(searchGyms(gyms, 'boulder plus'))).toEqual(['Boulder+'])
    expect(names(searchGyms(gyms, 'boulder'))).toEqual(['Boulder Planet', 'Boulder+'])
  })

  it('returns nothing when no gym matches', () => {
    expect(searchGyms(gyms, 'zzz')).toEqual([])
  })
})

describe('countActivePassesByGym', () => {
  const settings = DEFAULT_SETTINGS
  const today = '2026-10-01'
  const at = (id: string) => ({ kind: 'builtin', id }) as const

  it('counts active counted passes and memberships (frozen too) per gym', () => {
    const m = makeMembership({ gymRef: at('g1'), startDate: '2026-09-01', endDate: '2026-10-31' })
    const bundles = [
      bundle(makeCounted({ gymRef: at('g1') })),
      bundle(makeCounted({ gymRef: at('g1') })),
      bundle(m, { freezes: [makeFreeze(m.id, '2026-09-28', '2026-10-05')] }),
      bundle(makeCounted({ gymRef: at('g2') })),
    ]
    expect(countActivePassesByGym(bundles, today, settings)).toEqual({ g1: 3, g2: 1 })
  })

  it('does not count used-up, expired, single-entry or deleted passes', () => {
    const usedUp = makeCounted({ gymRef: at('g1'), totalEntries: 1 })
    const bundles = [
      bundle(usedUp, { uses: makeUses(usedUp.id, 1) }),
      bundle(makeCounted({ gymRef: at('g1'), expiryDate: '2026-09-30' })),
      bundle(makeMembership({ gymRef: at('g1'), endDate: '2026-09-30' })),
      bundle(makeSingle({ gymRef: at('g1') })),
      bundle(makeCounted({ gymRef: at('g1'), deletedAt: '2026-09-01T00:00:00.000Z' })),
    ]
    expect(countActivePassesByGym(bundles, today, settings)).toEqual({})
  })

  it('still counts a pass that expires today', () => {
    expect(
      countActivePassesByGym(
        [bundle(makeCounted({ gymRef: at('g1'), expiryDate: today }))],
        today,
        settings,
      ),
    ).toEqual({ g1: 1 })
  })
})

describe('describeTemplate', () => {
  const t = (overrides: Partial<GymTemplate>): GymTemplate => ({
    id: 'x',
    source: 'builtin',
    passType: 'multipass',
    name: 'n',
    totalEntries: null,
    billingPeriod: null,
    priceCents: null,
    validityMonths: null,
    comments: null,
    ...overrides,
  })

  it('describes each pass type', () => {
    expect(describeTemplate(t({ totalEntries: 10 }))).toBe('10 entries')
    expect(describeTemplate(t({ totalEntries: 1 }))).toBe('1 entry')
    expect(describeTemplate(t({ passType: 'class_pack', totalEntries: 4 }))).toBe('4 sessions')
    expect(describeTemplate(t({ passType: 'membership', billingPeriod: 'monthly' }))).toBe(
      'Monthly',
    )
    expect(describeTemplate(t({ passType: 'membership', billingPeriod: null }))).toBe('Membership')
    expect(describeTemplate(t({ passType: 'single_entry' }))).toBe('Single entry')
  })

  it("adds the user's saved validity", () => {
    expect(describeTemplate(t({ source: 'user', totalEntries: 10, validityMonths: 6 }))).toBe(
      '10 entries · 6 months',
    )
    expect(describeTemplate(t({ source: 'user', totalEntries: 10, validityMonths: 1 }))).toBe(
      '10 entries · 1 month',
    )
  })
})

describe('templateDetails', () => {
  const t = (overrides: Partial<GymTemplate>): GymTemplate => ({
    id: 'x',
    source: 'user',
    passType: 'multipass',
    name: 'Multipass',
    totalEntries: null,
    billingPeriod: null,
    priceCents: null,
    validityMonths: null,
    comments: null,
    ...overrides,
  })

  it('built-in options lead with their type, since their name is the gym’s own', () => {
    expect(templateDetails(t({ source: 'builtin', name: '10-Pass', totalEntries: 10 }))).toEqual([
      'Multipass',
      '10 entries',
    ])
  })

  it('user options skip the type (it is the name) and add validity and price', () => {
    expect(templateDetails(t({ totalEntries: 10, validityMonths: 6, priceCents: 12000 }))).toEqual([
      '10 entries',
      '6 months',
      'S$120.00',
    ])
    expect(
      templateDetails(
        t({
          passType: 'membership',
          name: 'Membership',
          billingPeriod: 'yearly',
          validityMonths: 12,
        }),
      ),
    ).toEqual(['Yearly', '12 months'])
  })

  it('does not repeat the name, so a single entry has nothing extra to say', () => {
    expect(templateDetails(t({ passType: 'single_entry', name: 'Single entry' }))).toEqual([])
    expect(
      templateDetails(t({ passType: 'single_entry', name: 'Single entry', priceCents: 2200 })),
    ).toEqual(['S$22.00'])
    expect(
      templateDetails(t({ source: 'builtin', passType: 'single_entry', name: 'Day pass' })),
    ).toEqual(['Single entry'])
  })
})

describe('normalizeWebsite', () => {
  it('turns empty input into null and adds https:// to bare addresses', () => {
    expect(normalizeWebsite('')).toBeNull()
    expect(normalizeWebsite('   ')).toBeNull()
    expect(normalizeWebsite('example.com')).toBe('https://example.com')
    expect(normalizeWebsite(' www.example.com/gym ')).toBe('https://www.example.com/gym')
  })

  it('keeps addresses that already have a scheme', () => {
    expect(normalizeWebsite('http://example.com')).toBe('http://example.com')
    expect(normalizeWebsite('HTTPS://example.com')).toBe('HTTPS://example.com')
  })
})
