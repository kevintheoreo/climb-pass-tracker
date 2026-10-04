import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const day = (offset: number) => addDays(today, offset)
const later = () => new Promise<void>((resolve) => setTimeout(resolve, 5)) // creation times differ

const BOULDER = BUILTIN_GYMS[0]!
const boulder = { kind: 'builtin', id: BOULDER.id } as const

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef: boulder,
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: day(-30),
    expiryDate: day(100),
    totalEntries: 10,
    initialUsed: 3,
    ...overrides,
  }) as PassInput

const membership = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef: boulder,
    passType: 'membership',
    priceCents: null,
    comments: null,
    purchaseDate: day(-5),
    expiryDate: day(200),
    monthlyEntries: null,
    resetDay: null,
    ...overrides,
  }) as PassInput

/** The rows of a list: its direct items only, not the status badges inside them. */
const rowsOf = async (name: string) =>
  Array.from((await screen.findByRole('list', { name })).children) as HTMLElement[]
/** Only the row's own text, not its status badges (which are a list item too). */
const rowText = (row: HTMLElement) => row.textContent ?? ''

beforeEach(async () => {
  await repo.clearAllData()
})

describe('main screen — the list of rows', () => {
  it('says so when there are no passes yet', async () => {
    renderAt()
    expect(await screen.findByText(/No passes yet/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Passes' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Finished/)).not.toBeInTheDocument()
  })

  it('shows Gym, Type, Expiry and Left for each pass', async () => {
    await repo.createPass(multipass())
    renderAt()
    const [row] = await rowsOf('Passes')
    expect(row).toHaveTextContent(BOULDER.name)
    expect(row).toHaveTextContent('Multipass')
    expect(row).toHaveTextContent(/\d{1,2} [A-Z][a-z]{2} \d{4}/)
    expect(row).toHaveTextContent(/in 3 months/) // 100 days, in months (D43)
    expect(row).toHaveTextContent('7 / 10')
  })

  it('lists passes newest first, and keeps two passes at one gym as two rows (D23, D41)', async () => {
    await repo.createPass(multipass({ expiryDate: day(40), totalEntries: 10, initialUsed: 0 }))
    await later()
    await repo.createPass(multipass({ expiryDate: day(100), totalEntries: 20, initialUsed: 0 }))
    renderAt()
    const rows = await rowsOf('Passes')
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => /\d+ \/ (\d+)/.exec(rowText(r))?.[1])).toEqual(['20', '10'])
    expect(rows.every((r) => rowText(r).includes(BOULDER.name))).toBe(true)
  })

  it('shows "Unlimited" for a membership and the count with its reset date for a monthly one', async () => {
    await repo.createPass(membership({ monthlyEntries: 8, expiryDate: day(60) }), {
      usedThisPeriod: 5,
      today,
    })
    await later()
    await repo.createPass(
      membership({ gymRef: { kind: 'builtin', id: BUILTIN_GYMS[1]!.id }, expiryDate: day(50) }),
    )
    renderAt()
    const rows = await rowsOf('Passes')
    expect(rows).toHaveLength(2)
    expect(rowText(rows[0]!)).toContain('Unlimited')
    expect(rowText(rows[0]!)).not.toMatch(/resets/)
    expect(rowText(rows[1]!)).toContain('3 / 8')
    expect(rowText(rows[1]!)).toMatch(/resets \d{1,2} [A-Z][a-z]{2}/)
  })

  it('shows a single entry with no expiry as 1 / 1', async () => {
    await repo.createPass({
      gymRef: boulder,
      passType: 'single_entry',
      priceCents: null,
      comments: null,
      purchaseDate: today,
      expiryDate: null,
      totalEntries: 1,
      initialUsed: 0,
    } as PassInput)
    await later()
    await repo.createPass(multipass()) // added last, so on top
    renderAt()
    const rows = await rowsOf('Passes')
    expect(rowText(rows[0]!)).toContain('Multipass')
    expect(rowText(rows[1]!)).toContain('Single entry')
    expect(rowText(rows[1]!)).toContain('1 / 1')
    expect(rowText(rows[1]!)).toContain('No expiry')
  })

  it('flags expiring-soon and low passes', async () => {
    await repo.createPass(multipass({ expiryDate: day(200), totalEntries: 10, initialUsed: 0 }))
    await later()
    await repo.createPass(multipass({ expiryDate: day(5), totalEntries: 10, initialUsed: 9 })) // on top
    renderAt()
    const [flagged, fine] = await rowsOf('Passes')
    const badges = within(within(flagged!).getByRole('list', { name: 'Status' })).getAllByRole(
      'listitem',
    )
    expect(badges.map((b) => b.textContent)).toEqual(['Expiring soon', 'Low'])
    expect(within(fine!).queryByRole('list', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('moves used-up and expired passes into a collapsed Finished section', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ totalEntries: 5, initialUsed: 5 }))
    await repo.createPass(multipass({ expiryDate: day(-3), totalEntries: 10, initialUsed: 4 }))
    await repo.createPass(multipass())
    renderAt()

    expect(await rowsOf('Passes')).toHaveLength(1)
    const summary = screen.getByText('Finished (2)')
    const finishedList = screen.getByRole('list', { name: 'Finished passes' })
    expect(finishedList).not.toBeVisible()

    await user.click(summary)
    expect(finishedList).toBeVisible()
    const finished = within(finishedList)
      .getAllByRole('listitem')
      .filter((li) => li.textContent?.includes(BOULDER.name))
    expect(finished).toHaveLength(2)
    expect(finishedList).toHaveTextContent('Used up')
    expect(finishedList).toHaveTextContent('Expired – 6 unused')
  })

  it('shows "No active passes" when everything is finished', async () => {
    await repo.createPass(multipass({ totalEntries: 5, initialUsed: 5 }))
    renderAt()
    expect(await screen.findByText('No active passes.')).toBeInTheDocument()
    expect(screen.getByText('Finished (1)')).toBeInTheDocument()
  })

  it('leaves out deleted passes, and names a gym the user created', async () => {
    const { ref } = await repo.findOrCreateGym('Zig Zag Wall')
    await repo.createPass(multipass({ gymRef: ref }))
    const gone = await repo.createPass(multipass())
    await repo.deletePass(gone.id)
    renderAt()
    const rows = await rowsOf('Passes')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Zig Zag Wall')
  })

  it('updates by itself when a pass is added', async () => {
    renderAt()
    await screen.findByText(/No passes yet/)
    await act(async () => {
      await repo.createPass(multipass())
    })
    expect(await rowsOf('Passes')).toHaveLength(1)
    expect(screen.queryByText(/No passes yet/)).not.toBeInTheDocument()
  })

  it('names an unknown gym instead of breaking', async () => {
    await repo.createPass(multipass({ gymRef: { kind: 'user', id: 'missing' } }))
    renderAt()
    const [row] = await rowsOf('Passes')
    expect(row).toHaveTextContent('Unknown gym')
  })

  it('reads sensibly to a screen reader: each value has a label', async () => {
    await repo.createPass(multipass())
    renderAt()
    const [row] = await rowsOf('Passes')
    for (const label of ['Gym:', 'Type:', 'Expiry:', 'Left:']) expect(row).toHaveTextContent(label)
  })
})
