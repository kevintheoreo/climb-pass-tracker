// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client, type QueryResult } from 'pg'
import { BUILTIN_GYMS } from '../../src/data/gyms'
import { gymSeedSql } from '../../src/data/gymSeed'

/**
 * The account database's rules, tested on a real PostgreSQL (plan steps 2.1 and 2.8).
 *
 * Set TEST_DATABASE_URL to a superuser connection to run them, for example
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
 * Each run makes a throwaway database, loads a small stand-in for Supabase's `auth` schema, the
 * migration and the gym seed, and drops it afterwards. Without the variable these tests are
 * skipped (CI sets it, using a PostgreSQL service).
 */
const url = process.env.TEST_DATABASE_URL
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const ALICE = '00000000-0000-4000-8000-00000000a11c'
const BOB = '00000000-0000-4000-8000-0000000000b0'
const GYM = BUILTIN_GYMS[0]!.id
const T0 = '2026-10-01T00:00:00Z'
const T1 = '2026-10-02T00:00:00Z'
const T2 = '2026-10-03T00:00:00Z'

type Row = Record<string, unknown>
type Query = (text: string, params?: unknown[]) => Promise<QueryResult<Row>>

const pass = (over: Row = {}): Row => ({
  id: randomUUID(),
  gym_kind: 'builtin',
  gym_id: GYM,
  pass_type: 'multipass',
  purchase_date: '2026-10-01',
  expiry_date: '2027-04-01',
  total_entries: 10,
  initial_used: 0,
  created_at: T0,
  updated_at: T0,
  ...over,
})
const use = (passId: string, over: Row = {}): Row => ({
  id: randomUUID(),
  pass_id: passId,
  used_at: T1,
  created_at: T1,
  updated_at: T1,
  ...over,
})
const freeze = (passId: string, over: Row = {}): Row => ({
  id: randomUUID(),
  pass_id: passId,
  start_date: '2026-11-01',
  end_date: '2026-11-10',
  created_at: T0,
  updated_at: T0,
  ...over,
})
const userGym = (over: Row = {}): Row => ({
  id: randomUUID(),
  name: 'Zig Zag Wall',
  created_at: T0,
  updated_at: T0,
  ...over,
})

async function insert(q: Query, table: string, row: Row) {
  const keys = Object.keys(row)
  const marks = keys.map((_, i) => `$${i + 1}`).join(', ')
  const result = await q(
    `insert into public.${table} (${keys.join(', ')}) values (${marks}) returning *`,
    keys.map((k) => row[k]),
  )
  return result.rows[0]!
}

/** An upsert the way the app will send it: insert, or update the row with the same id. */
async function upsert(q: Query, table: string, row: Row) {
  const keys = Object.keys(row)
  const marks = keys.map((_, i) => `$${i + 1}`).join(', ')
  const sets = keys.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`)
  await q(
    `insert into public.${table} (${keys.join(', ')}) values (${marks}) ` +
      `on conflict (id) do update set ${sets.join(', ')}`,
    keys.map((k) => row[k]),
  )
}

describe.skipIf(!url)('account database', () => {
  let admin: Client
  let db: Client
  const name = `climb_test_${process.pid}_${Date.now()}`

  /** Runs `run` as one signed-in person (or as a signed-out visitor), the way the API would. */
  async function as<T>(user: string | null, run: (q: Query) => Promise<T>): Promise<T> {
    await db.query('begin')
    try {
      await db.query(`set local role ${user ? 'authenticated' : 'anon'}`)
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(user ? { sub: user, role: 'authenticated' } : { role: 'anon' }),
      ])
      const result = await run((text, params) => db.query<Row>(text, params))
      await db.query('commit')
      return result
    } catch (error) {
      await db.query('rollback')
      throw error
    }
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: url })
    await admin.connect()
    await admin.query(`create database ${name}`)
    const target = new URL(url!)
    target.pathname = `/${name}`
    db = new Client({ connectionString: target.toString() })
    await db.connect()
    await db.query(read('tests/auth_stub.sql'))
    await db.query(read('migrations/20261002000000_init.sql'))
    await db.query(read('seed_gyms.sql'))
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`drop database if exists ${name} with (force)`)
    await admin?.end()
  })

  beforeEach(async () => {
    await db.query('truncate auth.users cascade')
    await db.query('insert into auth.users (id) values ($1), ($2)', [ALICE, BOB])
  })

  describe('built-in gyms', () => {
    it('the seed matches the bundled list, and the file is up to date', async () => {
      expect(read('seed_gyms.sql')).toBe(gymSeedSql(BUILTIN_GYMS))
      const { rows } = await db.query('select id, name from public.gyms order by sort_order')
      expect(rows).toEqual(BUILTIN_GYMS.map((g) => ({ id: g.id, name: g.name })))
    })

    it('anyone can read the names, signed in or not', async () => {
      const signedOut = await as(null, (q) => q('select id, name from public.gyms'))
      const signedIn = await as(ALICE, (q) => q('select id, name from public.gyms'))
      expect(signedOut.rowCount).toBe(BUILTIN_GYMS.length)
      expect(signedIn.rowCount).toBe(BUILTIN_GYMS.length)
    })

    it('nobody can change them through the API', async () => {
      await expect(
        as(ALICE, (q) =>
          q(`insert into public.gyms (id, name) values ($1, 'Mine')`, [randomUUID()]),
        ),
      ).rejects.toThrow(/permission denied/)
      await expect(as(ALICE, (q) => q(`update public.gyms set name = 'Hacked'`))).rejects.toThrow(
        /permission denied/,
      )
      await expect(as(ALICE, (q) => q(`delete from public.gyms`))).rejects.toThrow(
        /permission denied/,
      )
      await expect(as(null, (q) => q(`delete from public.gyms`))).rejects.toThrow(
        /permission denied/,
      )
    })

    it('running the seed again changes nothing, and a removed gym is hidden, not deleted', async () => {
      await db.query(read('seed_gyms.sql'))
      expect((await db.query('select 1 from public.gyms')).rowCount).toBe(BUILTIN_GYMS.length)
      await db.query(gymSeedSql(BUILTIN_GYMS.slice(0, 1)))
      const { rows } = await db.query('select id, is_active from public.gyms order by sort_order')
      expect(rows.map((r) => r.is_active)).toEqual([true, false])
      await db.query(read('seed_gyms.sql')) // put it back
      const after = await db.query('select is_active from public.gyms')
      expect(after.rows.every((r) => r.is_active === true)).toBe(true)
    })
  })

  describe('who can see and change what', () => {
    it('a signed-out visitor can read no personal data', async () => {
      for (const table of ['user_gyms', 'passes', 'freezes', 'uses', 'user_settings']) {
        await expect(as(null, (q) => q(`select * from public.${table}`))).rejects.toThrow(
          /permission denied/,
        )
      }
      await expect(as(null, (q) => insert(q, 'passes', pass()))).rejects.toThrow(
        /permission denied/,
      )
    })

    it('a person can add and read their own gym, pass, freeze, use and settings', async () => {
      const gym = userGym()
      const membership = pass({
        pass_type: 'membership',
        total_entries: null,
        initial_used: null,
        monthly_entries: 8,
      })
      await as(ALICE, async (q) => {
        await insert(q, 'user_gyms', gym)
        await insert(q, 'passes', membership)
        await insert(q, 'freezes', freeze(membership.id as string))
        await insert(q, 'uses', use(membership.id as string))
        await insert(q, 'user_settings', { updated_at: T0 })
      })
      const counts = await as(ALICE, async (q) => ({
        gyms: (await q('select * from public.user_gyms')).rowCount,
        passes: (await q('select * from public.passes')).rowCount,
        freezes: (await q('select * from public.freezes')).rowCount,
        uses: (await q('select * from public.uses')).rowCount,
        settings: (await q('select * from public.user_settings')).rowCount,
      }))
      expect(counts).toEqual({ gyms: 1, passes: 1, freezes: 1, uses: 1, settings: 1 })
    })

    it('user_id is filled in from the signed-in person when it is left out', async () => {
      const row = await as(ALICE, (q) => insert(q, 'passes', pass()))
      expect(row.user_id).toBe(ALICE)
    })

    it('nobody sees, changes or reuses somebody else’s rows', async () => {
      const alicePass = pass()
      const aliceGym = userGym()
      await as(ALICE, async (q) => {
        await insert(q, 'passes', alicePass)
        await insert(q, 'user_gyms', aliceGym)
        await insert(q, 'uses', use(alicePass.id as string))
        await insert(q, 'user_settings', { updated_at: T0 })
      })
      const bobSees = await as(BOB, async (q) => [
        (await q('select * from public.passes')).rowCount,
        (await q('select * from public.user_gyms')).rowCount,
        (await q('select * from public.uses')).rowCount,
        (await q('select * from public.user_settings')).rowCount,
      ])
      expect(bobSees).toEqual([0, 0, 0, 0])

      // Updates reach no rows.
      const changed = await as(BOB, (q) =>
        q(`update public.passes set comments = 'mine now', updated_at = $1`, [T2]),
      )
      expect(changed.rowCount).toBe(0)
      const comments = await db.query('select comments from public.passes')
      expect(comments.rows[0]!.comments).toBeNull()

      // Bob cannot write rows as Alice, nor attach anything to Alice's pass.
      await expect(as(BOB, (q) => insert(q, 'passes', pass({ user_id: ALICE })))).rejects.toThrow(
        /row-level security/,
      )
      await expect(as(BOB, (q) => insert(q, 'uses', use(alicePass.id as string)))).rejects.toThrow(
        /foreign key|row-level security/,
      )
      await expect(
        as(BOB, (q) => insert(q, 'freezes', freeze(alicePass.id as string))),
      ).rejects.toThrow(/foreign key|row-level security/)

      // An upsert onto Alice's id is refused rather than taking the row over.
      await expect(
        as(BOB, (q) => upsert(q, 'passes', { ...alicePass, comments: 'taken', updated_at: T2 })),
      ).rejects.toThrow(/row-level security/)
      expect((await db.query('select user_id from public.passes')).rows[0]!.user_id).toBe(ALICE)
    })

    it('nobody can hard-delete through the API: deleting is setting deleted_at', async () => {
      const row = pass()
      await as(ALICE, (q) => insert(q, 'passes', row))
      await expect(as(ALICE, (q) => q('delete from public.passes'))).rejects.toThrow(
        /permission denied/,
      )
    })

    it('deleting an account deletes everything the person had', async () => {
      const p = pass()
      await as(ALICE, async (q) => {
        await insert(q, 'user_gyms', userGym())
        await insert(q, 'passes', p)
        await insert(q, 'uses', use(p.id as string))
        await insert(q, 'freezes', freeze(p.id as string))
        await insert(q, 'user_settings', { updated_at: T0 })
      })
      await as(BOB, (q) => insert(q, 'passes', pass()))
      await db.query('delete from auth.users where id = $1', [ALICE])
      for (const table of ['user_gyms', 'passes', 'uses', 'freezes', 'user_settings']) {
        const left = await db.query(`select user_id from public.${table}`)
        expect(left.rows.every((r) => r.user_id !== ALICE)).toBe(true)
      }
      expect((await db.query('select 1 from public.passes')).rowCount).toBe(1) // Bob's stays
    })
  })

  describe('the rules a pass must follow (FR-22)', () => {
    const accepted: [string, Row][] = [
      ['a multipass', pass()],
      ['a class pack', pass({ pass_type: 'class_pack', total_entries: 1000, initial_used: 1000 })],
      [
        'a single entry with no expiry',
        pass({ pass_type: 'single_entry', total_entries: 1, expiry_date: null }),
      ],
      [
        'a single entry already used',
        pass({ pass_type: 'single_entry', total_entries: 1, initial_used: 1 }),
      ],
      [
        'an unlimited membership',
        pass({ pass_type: 'membership', total_entries: null, initial_used: null }),
      ],
      [
        'a monthly membership with a reset day',
        pass({
          pass_type: 'membership',
          total_entries: null,
          initial_used: null,
          monthly_entries: 8,
          reset_day: 31,
        }),
      ],
      ['a pass expiring the day it was bought', pass({ expiry_date: '2026-10-01' })],
      ['a price and a comment', pass({ price_cents: 12050, comments: 'x'.repeat(500) })],
    ]
    it.each(accepted)('accepts %s', async (_name, row) => {
      await as(ALICE, (q) => insert(q, 'passes', row))
    })

    const refused: [string, Row][] = [
      ['no entries', pass({ total_entries: 0 })],
      ['more than 1000 entries', pass({ total_entries: 1001 })],
      ['more already used than the total', pass({ total_entries: 5, initial_used: 6 })],
      ['a negative already-used count', pass({ initial_used: -1 })],
      ['a multipass with no expiry', pass({ expiry_date: null })],
      ['an expiry before the purchase date', pass({ expiry_date: '2026-09-30' })],
      ['a single entry of 2', pass({ pass_type: 'single_entry', total_entries: 2 })],
      [
        'a single entry used twice',
        pass({ pass_type: 'single_entry', total_entries: 1, initial_used: 2 }),
      ],
      [
        'a membership with no expiry',
        pass({
          pass_type: 'membership',
          total_entries: null,
          initial_used: null,
          expiry_date: null,
        }),
      ],
      [
        'a membership with entries like a pack',
        pass({ pass_type: 'membership', initial_used: null }),
      ],
      [
        'an unlimited membership with a reset day',
        pass({
          pass_type: 'membership',
          total_entries: null,
          initial_used: null,
          reset_day: 15,
        }),
      ],
      [
        'a reset day of 32',
        pass({
          pass_type: 'membership',
          total_entries: null,
          initial_used: null,
          monthly_entries: 8,
          reset_day: 32,
        }),
      ],
      [
        'a monthly allowance of 0',
        pass({
          pass_type: 'membership',
          total_entries: null,
          initial_used: null,
          monthly_entries: 0,
        }),
      ],
      ['a multipass with a monthly allowance', pass({ monthly_entries: 8 })],
      ['a negative price', pass({ price_cents: -1 })],
      ['a comment over 500 characters', pass({ comments: 'x'.repeat(501) })],
      ['an unknown type', pass({ pass_type: 'punch_card' })],
      ['an unknown gym kind', pass({ gym_kind: 'shared' })],
    ]
    it.each(refused)('refuses %s', async (_name, row) => {
      await expect(as(ALICE, (q) => insert(q, 'passes', row))).rejects.toThrow(
        /violates|null value/,
      )
    })

    it('refuses bad freezes, uses, gyms and settings', async () => {
      const p = pass()
      await as(ALICE, (q) => insert(q, 'passes', p))
      const bad = (table: string, row: Row) =>
        expect(as(ALICE, (q) => insert(q, table, row))).rejects.toThrow(/violates|null value/)
      await bad(
        'freezes',
        freeze(p.id as string, { start_date: '2026-11-10', end_date: '2026-11-01' }),
      )
      await bad('uses', use('00000000-0000-4000-8000-000000000999'))
      await bad('user_gyms', userGym({ name: '   ' }))
      await bad('user_gyms', userGym({ name: 'x'.repeat(101) }))
      await bad('user_settings', { updated_at: T0, expiry_reminder_days: [1, 2, 3, 4, 5, 6] })
      await bad('user_settings', { updated_at: T0, expiry_reminder_days: [0] })
      await bad('user_settings', { updated_at: T0, expiry_reminder_days: [366] })
      await bad('user_settings', { updated_at: T0, low_entries_threshold: 101 })
      await bad('user_settings', { updated_at: T0, dismissed_reminders: '[]' })
    })

    it('settings start at the app’s defaults, and there is one row per person', async () => {
      const row = await as(ALICE, (q) => insert(q, 'user_settings', { updated_at: T0 }))
      expect(row).toMatchObject({
        expiry_reminder_days: [14, 3],
        low_entries_threshold: 2,
        expiry_reminders_enabled: true,
        low_reminders_enabled: true,
        reset_reminders_enabled: true,
        dismissed_reminders: {},
      })
      await expect(
        as(ALICE, (q) => insert(q, 'user_settings', { updated_at: T1 })),
      ).rejects.toThrow(/duplicate key/)
    })
  })

  describe('last write wins (FR-40)', () => {
    it('a newer edit is kept; an older or equal one is ignored', async () => {
      const row = pass({ updated_at: T1, comments: 'first' })
      await as(ALICE, (q) => insert(q, 'passes', row))

      await as(ALICE, (q) => upsert(q, 'passes', { ...row, comments: 'older', updated_at: T0 }))
      expect((await db.query('select comments from public.passes')).rows[0]!.comments).toBe('first')

      await as(ALICE, (q) => upsert(q, 'passes', { ...row, comments: 'same time', updated_at: T1 }))
      expect((await db.query('select comments from public.passes')).rows[0]!.comments).toBe('first')

      await as(ALICE, (q) => upsert(q, 'passes', { ...row, comments: 'newer', updated_at: T2 }))
      const kept = await db.query('select comments, updated_at from public.passes')
      expect(kept.rows[0]!.comments).toBe('newer')
      expect((kept.rows[0]!.updated_at as Date).toISOString()).toBe('2026-10-03T00:00:00.000Z')
    })

    it('two devices that edited the same pass end up with the later edit, whichever arrives last', async () => {
      const base = pass({ updated_at: T0 })
      await as(ALICE, (q) => insert(q, 'passes', base))
      const phone = { ...base, comments: 'phone', updated_at: T2 }
      const tablet = { ...base, comments: 'tablet', updated_at: T1 }
      await as(ALICE, (q) => upsert(q, 'passes', phone))
      await as(ALICE, (q) => upsert(q, 'passes', tablet)) // arrives later but is older
      expect((await db.query('select comments from public.passes')).rows[0]!.comments).toBe('phone')
    })

    it('a stale edit does not move server_updated_at, an accepted one does', async () => {
      const row = pass({ updated_at: T1 })
      await as(ALICE, (q) => insert(q, 'passes', row))
      const first = (await db.query('select server_updated_at from public.passes')).rows[0]!
        .server_updated_at as Date

      await as(ALICE, (q) => upsert(q, 'passes', { ...row, comments: 'stale', updated_at: T0 }))
      const afterStale = (await db.query('select server_updated_at from public.passes')).rows[0]!
        .server_updated_at as Date
      expect(afterStale.getTime()).toBe(first.getTime())

      await as(ALICE, (q) => upsert(q, 'passes', { ...row, comments: 'fresh', updated_at: T2 }))
      const afterFresh = (await db.query('select server_updated_at from public.passes')).rows[0]!
        .server_updated_at as Date
      expect(afterFresh.getTime()).toBeGreaterThan(first.getTime())
    })

    it('a deletion is a newer edit that sets deleted_at, and it can be pulled like any change', async () => {
      const row = pass()
      await as(ALICE, (q) => insert(q, 'passes', row))
      const cursor = (await db.query('select clock_timestamp() as now')).rows[0]!.now as Date
      await as(ALICE, (q) =>
        q('update public.passes set deleted_at = $1, updated_at = $1 where id = $2', [T2, row.id]),
      )
      const pulled = await as(ALICE, (q) =>
        q('select id, deleted_at from public.passes where server_updated_at > $1', [cursor]),
      )
      expect(pulled.rowCount).toBe(1)
      expect(pulled.rows[0]!.deleted_at).not.toBeNull()
    })

    it('a pull returns only what changed since the cursor, in order, for that person only', async () => {
      const a = pass()
      const b = pass()
      await as(ALICE, (q) => insert(q, 'passes', a))
      const cursor = (await db.query('select clock_timestamp() as now')).rows[0]!.now as Date
      await as(ALICE, (q) => insert(q, 'passes', b))
      await as(BOB, (q) => insert(q, 'passes', pass()))
      const pulled = await as(ALICE, (q) =>
        q('select id from public.passes where server_updated_at > $1 order by server_updated_at', [
          cursor,
        ]),
      )
      expect(pulled.rows.map((r) => r.id)).toEqual([b.id])
    })

    it('the owner and the creation time cannot be changed', async () => {
      const row = pass()
      await as(ALICE, (q) => insert(q, 'passes', row))
      await expect(
        as(ALICE, (q) =>
          q('update public.passes set user_id = $1, updated_at = $2 where id = $3', [
            BOB,
            T2,
            row.id,
          ]),
        ),
      ).rejects.toThrow(/row-level security|user_id cannot be changed/)
      await as(ALICE, (q) =>
        q(`update public.passes set created_at = '2000-01-01', updated_at = $1 where id = $2`, [
          T2,
          row.id,
        ]),
      )
      const kept = await db.query('select created_at from public.passes')
      expect((kept.rows[0]!.created_at as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    })

    it('the owner cannot be changed even by a request that skips row-level security', async () => {
      const row = pass()
      await as(ALICE, (q) => insert(q, 'passes', row))
      await expect(
        db.query('update public.passes set user_id = $1, updated_at = $2 where id = $3', [
          BOB,
          T2,
          row.id,
        ]),
      ).rejects.toThrow(/user_id cannot be changed/)
    })

    it('settings follow the same rule', async () => {
      await as(ALICE, (q) =>
        insert(q, 'user_settings', { updated_at: T1, low_entries_threshold: 4 }),
      )
      await as(ALICE, (q) =>
        q('update public.user_settings set low_entries_threshold = 9, updated_at = $1', [T0]),
      )
      expect(
        (await db.query('select low_entries_threshold from public.user_settings')).rows[0]!
          .low_entries_threshold,
      ).toBe(4)
      await as(ALICE, (q) =>
        q('update public.user_settings set low_entries_threshold = 9, updated_at = $1', [T2]),
      )
      expect(
        (await db.query('select low_entries_threshold from public.user_settings')).rows[0]!
          .low_entries_threshold,
      ).toBe(9)
    })
  })
})
