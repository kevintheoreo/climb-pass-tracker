import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { currentPeriod } from '../../domain/cycle'
import { addDays, formatMonthYear, formatWeekdayDayMonth, todayLocal } from '../../domain/dates'
import { at } from '../../domain/testFactories'
import type { MembershipPass, PassInput } from '../../domain/types'

const today = todayLocal()
const day = (offset: number) => addDays(today, offset)

const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: day(-60),
    expiryDate: day(100),
    totalEntries: 40,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

const spend = async (passId: string, date: string, hour = 12) => {
  const result = await repo.useEntry(passId, today, at(date, hour))
  if (!result.ok) throw new Error('could not use an entry')
  return result.use
}

/** The History section, opened. */
async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText(/History \(\d+\)/))
  return screen.getByRole('group', { name: 'Usage history' })
}
const lines = (list: HTMLElement) => within(list).getAllByRole('listitem')

beforeEach(async () => {
  await repo.clearAllData()
})

describe('the History section (D58, FR-77)', () => {
  it('is not there while nothing has been used', async () => {
    await repo.createPass(multipass())
    renderApp()
    await screen.findByText('Add a pass')
    expect(screen.queryByText(/History \(/)).not.toBeInTheDocument()
  })

  it('lists every use, newest first, with the date, gym and pass type', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-9))
    await spend(pass.id, day(-2))
    await spend(pass.id, day(-5))
    renderApp()
    expect(await screen.findByText('History (3)')).toBeInTheDocument()
    const rows = lines(await openHistory(user))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent(`${BUILTIN_GYMS[0]!.name} · Multipass`)
    const dates = rows.map((row) => row.querySelector('p')!.textContent)
    expect(dates).toEqual([day(-2), day(-5), day(-9)].map(formatWeekdayDayMonth))
  })

  it('also lists the uses of a pass that has moved to Finished', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ totalEntries: 1 }))
    await spend(pass.id, day(-1))
    renderApp()
    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()
    expect(lines(await openHistory(user))).toHaveLength(1)
  })

  it('follows a new use right away', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-3))
    renderApp()
    await screen.findByText('History (1)')
    await user.click(screen.getByRole('button', { name: /^Use one entry/ }))
    expect(await screen.findByText('History (2)')).toBeInTheDocument()
  })

  it('says that entries counted as already used have no date, only when there are some', async () => {
    const pass = await repo.createPass(multipass({ initialUsed: 3 }))
    await spend(pass.id, day(-1))
    renderApp()
    expect(await screen.findByText(/have no date, so they are not listed/)).toBeInTheDocument()
  })

  it('does not say it when every entry has a date', async () => {
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-1))
    renderApp()
    await screen.findByText('History (1)')
    expect(screen.queryByText(/have no date/)).not.toBeInTheDocument()
  })

  it('shows 30 lines first and 30 more each time "Show more" is pressed', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ totalEntries: 80 }))
    for (let i = 0; i < 65; i++) await spend(pass.id, day(-1 - (i % 50)), 8 + (i % 10))
    renderApp()
    const list = await openHistory(user)
    expect(lines(list)).toHaveLength(30)
    await user.click(screen.getByRole('button', { name: 'Show more (35 more)' }))
    expect(lines(list)).toHaveLength(60)
    await user.click(screen.getByRole('button', { name: 'Show more (5 more)' }))
    expect(lines(list)).toHaveLength(65)
    expect(screen.queryByRole('button', { name: /^Show more/ })).not.toBeInTheDocument()
  })
})

describe('the lines of the History section (D58)', () => {
  it('groups the lines by month, newest month first, under a heading', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-1))
    await spend(pass.id, day(-45))
    await spend(pass.id, day(-2))
    renderApp()
    const group = await openHistory(user)
    const headings = within(group).getAllByRole('heading', { level: 3 })
    const months = [day(-1), day(-45)].map(formatMonthYear)
    const expected = [...new Set([formatMonthYear(day(-1)), formatMonthYear(day(-2)), months[1]!])]
    expect(headings.map((h) => h.textContent)).toEqual(expected)
    // Each heading names its own list of lines.
    for (const heading of headings) {
      expect(within(group).getByRole('region', { name: heading.textContent! })).toBeInTheDocument()
    }
    expect(lines(group)).toHaveLength(3)
  })

  it('writes a line as weekday, day and month (the year is in the heading)', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-3))
    renderApp()
    const [line] = lines(await openHistory(user))
    expect(line!.querySelector('p')!.textContent).toBe(formatWeekdayDayMonth(day(-3)))
    expect(line!.querySelector('p')!.textContent).not.toMatch(/\d{4}/)
  })

  it('opens the date box when the line itself is tapped, not only its button', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await spend(pass.id, day(-3))
    renderApp()
    const [line] = lines(await openHistory(user))
    await user.click(within(line!).getByText(BUILTIN_GYMS[0]!.name, { exact: false }))
    expect(screen.getByLabelText('Date of this entry')).toHaveValue(day(-3))
  })

  it('tells how to add a forgotten climb, above the list so it is seen without scrolling', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ totalEntries: 80 }))
    for (let i = 0; i < 40; i++) await spend(pass.id, day(-1 - i), 8 + (i % 10))
    renderApp()
    const group = await openHistory(user)
    const hint = screen.getByText(
      'Forgot to log a climb? Tap − on the pass, then change that entry’s date here.',
    )
    expect(hint).toBeInTheDocument()
    // It comes before the first line of the list in the page, not after the last.
    expect(hint.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/Forgot to tap/)).not.toBeInTheDocument()
  })
})

describe('changing the date of a use', () => {
  async function twoUses(user: ReturnType<typeof userEvent.setup>) {
    const pass = await repo.createPass(multipass())
    const first = await spend(pass.id, day(-4))
    const second = await spend(pass.id, day(-10))
    renderApp()
    const list = await openHistory(user)
    return { pass, first, second, list }
  }
  const dateBox = () => screen.getByLabelText('Date of this entry')

  it('saves only when Save is pressed, then re-sorts the list and says "Changes saved"', async () => {
    const user = userEvent.setup()
    const { first, list } = await twoUses(user)
    expect(lines(list)[0]).toHaveTextContent(formatWeekdayDayMonth(day(-4)))
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    expect(dateBox()).toHaveValue(day(-4))
    fireEvent.change(dateBox(), { target: { value: day(-20) } })
    expect((await repo.listUses(first.passId)).find((u) => u.id === first.id)!.usedAt).toBe(
      first.usedAt,
    ) // not saved yet

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(lines(list)[0]).toHaveTextContent(formatWeekdayDayMonth(day(-10))))
    expect(lines(list)[1]).toHaveTextContent(formatWeekdayDayMonth(day(-20)))
    expect(screen.queryByLabelText('Date of this entry')).not.toBeInTheDocument()
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    const stored = (await repo.listUses(first.passId)).find((u) => u.id === first.id)!
    expect(stored.usedAt).toBe(at(day(-20)))
  })

  it('Enter in the date box saves too', async () => {
    const user = userEvent.setup()
    const { first, list } = await twoUses(user)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    fireEvent.change(dateBox(), { target: { value: day(-6) } })
    await user.type(dateBox(), '{Enter}')
    await waitFor(async () =>
      expect((await repo.listUses(first.passId)).find((u) => u.id === first.id)!.usedAt).toBe(
        at(day(-6)),
      ),
    )
  })

  it('Cancel and Escape drop what was typed and give the focus back to the button', async () => {
    const user = userEvent.setup()
    const { first, list } = await twoUses(user)
    const open = () =>
      user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    await open()
    fireEvent.change(dateBox(), { target: { value: day(-30) } })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Date of this entry')).not.toBeInTheDocument()
    expect(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ })).toHaveFocus()
    expect((await repo.listUses(first.passId)).find((u) => u.id === first.id)!.usedAt).toBe(
      first.usedAt,
    )

    await open()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Date of this entry')).not.toBeInTheDocument()
  })

  it('deletes an entry only after the person confirms, says so, and gives the entry back', async () => {
    const user = userEvent.setup()
    const { pass, first, list } = await twoUses(user)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    await user.click(screen.getByRole('button', { name: 'Delete this entry' }))
    // Asked first: nothing is deleted yet, and Cancel backs out.
    expect(screen.getByRole('alertdialog', { name: 'Delete this entry' })).toBeInTheDocument()
    expect(await repo.listUses(pass.id)).toHaveLength(2)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    )
    expect(await repo.listUses(pass.id)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Delete this entry' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(async () => expect(await repo.listUses(pass.id)).toHaveLength(1))
    expect((await repo.listUses(pass.id))[0]!.id).not.toBe(first.id)
    expect(await screen.findByText('Entry deleted')).toBeInTheDocument()
    await waitFor(() => expect(lines(list)).toHaveLength(1))
    expect(screen.getByText(/History \(1\)/)).toBeInTheDocument()
    // The focus moves to the line that is left.
    await waitFor(() =>
      expect(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ })).toHaveFocus(),
    )
  })

  it('brings a used-up pass back to the main list when one of its entries is deleted', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ totalEntries: 1 }))
    await spend(pass.id, day(-2))
    renderApp()
    await screen.findByText(/Finished \(1\)/)
    const list = await openHistory(user)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    await user.click(screen.getByRole('button', { name: 'Delete this entry' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.queryByText(/Finished \(/)).not.toBeInTheDocument())
    expect(screen.queryByText(/History \(/)).not.toBeInTheDocument()
  })

  it('refuses a bad date with the reason, keeps the editor open and saves nothing', async () => {
    const user = userEvent.setup()
    const { first, list } = await twoUses(user)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))

    fireEvent.change(dateBox(), { target: { value: day(-61) } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `This pass was bought on ${formatLong(day(-60))}, so the date cannot be earlier.`,
    )

    fireEvent.change(dateBox(), { target: { value: day(1) } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // typing clears the message
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The date cannot be after today.')

    fireEvent.change(dateBox(), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid date.')

    expect(dateBox()).toBeInTheDocument()
    expect((await repo.listUses(first.passId)).find((u) => u.id === first.id)!.usedAt).toBe(
      first.usedAt,
    )
  })

  it('keeps the changed line in view and focused, with all lines shown, when it moves past line 30', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ totalEntries: 80, purchaseDate: day(-100) }))
    for (let i = 0; i < 35; i++) await spend(pass.id, day(-1 - i), 8 + (i % 10))
    renderApp()
    const list = await openHistory(user)
    expect(lines(list)).toHaveLength(30)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ }))
    fireEvent.change(dateBox(), { target: { value: day(-100) } }) // older than all the others
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(lines(list)).toHaveLength(35))
    const last = lines(list)[34]!
    expect(last).toHaveTextContent(formatWeekdayDayMonth(day(-100)))
    expect(within(last).getByRole('button', { name: /^Change date/ })).toHaveFocus()
    expect(screen.queryByRole('button', { name: /^Show more/ })).not.toBeInTheDocument()
  })

  it('tells a monthly membership that the month it would move into is full', async () => {
    const user = userEvent.setup()
    const created = await repo.createPass({
      gymRef,
      passType: 'membership',
      priceCents: null,
      comments: null,
      purchaseDate: day(-70),
      expiryDate: day(200),
      monthlyEntries: 2,
      resetDay: null,
    })
    const period = currentPeriod(created as MembershipPass, today)
    await spend(created.id, addDays(period.start, -2)) // last month: 2 of 2 used
    await spend(created.id, addDays(period.start, -4))
    await spend(created.id, today) // this month
    renderApp()
    const list = await openHistory(user)
    await user.click(within(lines(list)[0]!).getByRole('button', { name: /^Change date/ })) // today's
    fireEvent.change(dateBox(), { target: { value: addDays(period.start, -3) } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /All 2 entries are already used in the month of .+ to .+\. Pick another date\./,
    )
  })
})

/** `2026-10-02` → `2 Oct 2026`, as the screen writes it. */
function formatLong(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${month[m - 1]} ${y}`
}
