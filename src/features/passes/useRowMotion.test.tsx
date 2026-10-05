import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { buildRows, type Row } from '../../domain/rows'
import { DEFAULT_SETTINGS } from '../../domain/settings'
import { bundle, makeCounted } from '../../domain/testFactories'
import { RowList } from './RowList'
import { ROW_MOTION_MS, useRowMotion } from './useRowMotion'

const today = '2026-10-01'
const added = (n: number) => `2026-01-${String(n).padStart(2, '0')}T09:00:00.000Z`
const pass = (id: string, n: number, entries = 5) =>
  bundle(makeCounted({ id, createdAt: added(n), expiryDate: '2027-06-30', totalEntries: entries }))
const rowsOf = (...bundles: ReturnType<typeof bundle>[]) =>
  buildRows(bundles, () => 'Gym', today, DEFAULT_SETTINGS)
const ids = (rows: Row[]) => rows.map((r) => r.pass.id)
/** A one-entry pass whose entry is used: it is in Finished. */
const usedUp = (id: string, n: number) => ({
  ...pass(id, n, 1),
  uses: [
    {
      id: `use-${id}`,
      passId: id,
      usedAt: '2026-10-01T09:00:00.000Z',
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z',
      deletedAt: null,
    },
  ],
})

/** A phone with motion allowed (the test browser has no way to say, so motion is off by default). */
function allowMotion(allowed: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: allowed ? false : query.includes('reduce'),
    media: query,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  // @ts-expect-error the test browser has no matchMedia: put it back to that
  delete window.matchMedia
  vi.useRealTimers()
})

describe('useRowMotion (FR-61)', () => {
  it('keeps a row that moved to the other list on screen as a ghost, in its place, for a moment', () => {
    allowMotion(true)
    vi.useFakeTimers()
    const before = rowsOf(pass('a', 3), pass('b', 2, 1), pass('c', 1))
    const { result, rerender } = renderHook(({ list, other }) => useRowMotion(list, other), {
      initialProps: { list: before.active, other: before.finished },
    })
    expect(result.current.ghosts).toEqual([])

    // b used its last entry: it is now in Finished.
    const used = buildRows(
      [pass('a', 3), usedUp('b', 2), pass('c', 1)],
      () => 'Gym',
      today,
      DEFAULT_SETTINGS,
    )
    expect(ids(used.finished)).toEqual(['b'])
    rerender({ list: used.active, other: used.finished })
    expect(result.current.ghosts.map((g) => [g.row.pass.id, g.index])).toEqual([['b', 1]])

    act(() => {
      vi.advanceTimersByTime(ROW_MOTION_MS + 10)
    })
    expect(result.current.ghosts).toEqual([])
  })

  it('marks a row that came from the other list as entering, and not one that is new', () => {
    allowMotion(true)
    vi.useFakeTimers()
    const used = (id: string, n: number) => ({
      ...pass(id, n, 1),
      uses: [
        {
          id: 'u' + id,
          passId: id,
          usedAt: '2026-10-01T09:00:00.000Z',
          createdAt: '',
          updatedAt: '',
          deletedAt: null,
        },
      ],
    })
    const before = buildRows([pass('a', 3), used('b', 2)], () => 'Gym', today, DEFAULT_SETTINGS)
    expect(ids(before.finished)).toEqual(['b'])
    const { result, rerender } = renderHook(({ list, other }) => useRowMotion(list, other), {
      initialProps: { list: before.active, other: before.finished },
    })
    // b is given its entry back (comes up), and a brand new pass d is added.
    const after = buildRows(
      [pass('a', 3), pass('b', 2, 1), pass('d', 4)],
      () => 'Gym',
      today,
      DEFAULT_SETTINGS,
    )
    rerender({ list: after.active, other: after.finished })
    expect([...result.current.entering]).toEqual(['b'])
    act(() => {
      vi.advanceTimersByTime(ROW_MOTION_MS + 10)
    })
    expect([...result.current.entering]).toEqual([])
  })

  it('moves nothing when the device wants reduced motion, or cannot say', () => {
    for (const allowed of [false, undefined]) {
      if (allowed === undefined) {
        // @ts-expect-error no matchMedia at all
        delete window.matchMedia
      } else allowMotion(allowed)
      const before = rowsOf(pass('a', 2), pass('b', 1))
      const { result, rerender } = renderHook(({ list, other }) => useRowMotion(list, other), {
        initialProps: { list: before.active, other: before.finished },
      })
      const after = rowsOf(pass('a', 2))
      rerender({ list: after.active, other: [before.active[1]!] })
      expect(result.current.ghosts).toEqual([])
      expect(result.current.entering.size).toBe(0)
    }
  })

  it('does not keep a row that was deleted (it is in neither list)', () => {
    allowMotion(true)
    const before = rowsOf(pass('a', 2), pass('b', 1))
    const { result, rerender } = renderHook(({ list, other }) => useRowMotion(list, other), {
      initialProps: { list: before.active, other: before.finished },
    })
    const after = rowsOf(pass('a', 2))
    rerender({ list: after.active, other: after.finished })
    expect(result.current.ghosts).toEqual([])
  })
})

describe('a ghost row in the list', () => {
  it('is out of reach: inert and hidden from screen readers, with its buttons inside', () => {
    const rows = rowsOf(pass('a', 2), pass('b', 1))
    const handlers = {
      onToggle: () => {},
      onClose: () => {},
      onBuyAgain: () => {},
      onSaved: () => {},
    }
    render(
      <MemoryRouter>
        <RowList
          rows={[rows.active[0]!]}
          label="Passes"
          today={today}
          gyms={[]}
          openId={null}
          reminded={new Set()}
          addedId={null}
          ghosts={[{ row: rows.active[1]!, index: 1 }]}
          {...handlers}
        />
      </MemoryRouter>,
    )
    const items = screen.getByRole('list', { name: 'Passes' }).children
    expect(items).toHaveLength(2)
    expect(items[0]).not.toHaveAttribute('inert')
    expect(items[1]).toHaveAttribute('inert')
    expect(items[1]).toHaveAttribute('aria-hidden', 'true')
    expect(items[1]).toHaveClass('row-leaving')
    // Only the live row's buttons are in the accessibility tree.
    expect(screen.getAllByRole('button', { name: /^Use one entry/ })).toHaveLength(1)
  })
})
