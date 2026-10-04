import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const gymRef = { kind: 'builtin', id: BOULDER.id } as const

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: day(-30),
    expiryDate: day(100),
    totalEntries: 10,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

const monthly = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'membership',
    priceCents: null,
    comments: null,
    purchaseDate: day(-5),
    expiryDate: day(200),
    monthlyEntries: 8,
    resetDay: null,
    ...overrides,
  }) as PassInput

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

const panel = () => screen.getByRole('region', { name: /^Details:/ })
const field = (label: string | RegExp) => within(panel()).getByLabelText(label)
const totalOf = (pass: { passType: string; totalEntries?: number } | undefined) =>
  pass && 'totalEntries' in pass ? pass.totalEntries : undefined
const mainRows = async () =>
  Array.from((await screen.findByRole('list', { name: 'Passes' })).children) as HTMLElement[]

beforeEach(async () => {
  await repo.clearAllData()
})

describe('opening the details', () => {
  it('tapping the gym name opens and closes the panel, with the saved values in it', async () => {
    const user = userEvent.setup()
    await repo.createPass(
      multipass({ priceCents: 12050, comments: 'sale', initialUsed: 3, totalEntries: 12 }),
    )
    renderApp()
    const toggle = await screen.findByRole('button', { name: /show details/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(field('Gym')).toHaveValue(BOULDER.name)
    expect(field('Type')).toHaveValue('multipass')
    expect(field('Entries')).toHaveValue('12')
    expect(field('Expiry')).toHaveValue(day(100))
    expect(field('Purchase date')).toHaveValue(day(-30))
    expect(field(/^Price paid/)).toHaveValue('120.50')
    expect(field('Already used')).toHaveValue('3')
    expect(field(/^Comments/)).toHaveValue('sale')

    await user.click(toggle)
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()
  })

  it('tapping the rest of the row opens it, but tapping − or + does not', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass())
    renderApp()
    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    await user.click(screen.getByRole('button', { name: /^Use one entry/ }))
    await screen.findByText('9 / 10')
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Give one entry back/ }))
    await screen.findByText('10 / 10')
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()

    await user.click(within(row!).getByText('Multipass'))
    expect(await screen.findByRole('region', { name: /^Details:/ })).toBeInTheDocument()
  })

  it('only one panel is open at a time', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(60), totalEntries: 20 }))
    await later()
    await repo.createPass(multipass({ expiryDate: day(50) })) // added last, so listed first
    renderApp()
    await waitFor(async () => expect(await mainRows()).toHaveLength(2))
    const [first, second] = screen.getAllByRole('button', { name: /show details/ })
    await user.click(first!)
    await user.click(second!)
    expect(screen.getAllByRole('region', { name: /^Details:/ })).toHaveLength(1)
    expect(field('Entries')).toHaveValue('20')
  })

  it('shows the monthly boxes only for a membership with entries per month', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly({ resetDay: 20 }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    expect(field('Entries per month')).toHaveValue('8')
    expect(field('Already used this month')).toHaveValue('0')
    expect(field(/^Reset day/)).toHaveValue('20')
    expect(within(panel()).queryByLabelText('Already used')).not.toBeInTheDocument()
  })

  it('an unlimited membership has no entries, used or reset boxes to fill in', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly({ monthlyEntries: null }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    expect(field('Entries per month')).toHaveValue('')
    expect(within(panel()).queryByLabelText(/^Reset day/)).not.toBeInTheDocument()
    expect(within(panel()).queryByLabelText(/^Already used/)).not.toBeInTheDocument()
  })
})

describe('editing', () => {
  it('saves by itself when everything is valid and focus leaves the panel', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.type(field(/^Comments/), 'bought at a sale')
    await user.clear(field(/^Price paid/))
    await user.type(field(/^Price paid/), '99.9')
    expect((await repo.getPass(pass.id))?.comments).toBeNull() // still inside the panel

    await user.click(document.body)
    await waitFor(async () =>
      expect((await repo.getPass(pass.id))?.comments).toBe('bought at a sale'),
    )
    expect((await repo.getPass(pass.id))?.priceCents).toBe(9990)
  })

  it('the cost of one entry on the row follows a price typed in the panel (D44)', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ priceCents: null }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    expect(screen.queryByText(/each$/)).not.toBeInTheDocument()
    await user.type(field(/^Price paid/), '150{Enter}')
    expect(await screen.findByText('S$15.00 each')).toBeInTheDocument()
    await user.clear(field(/^Price paid/))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByText(/each$/)).not.toBeInTheDocument())
  })

  it('Enter saves too, and the row on screen follows', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.clear(field('Entries'))
    await user.type(field('Entries'), '20{Enter}')
    await waitFor(async () => expect(totalOf(await repo.getPass(pass.id))).toBe(20))
    expect(await screen.findByText('20 / 20')).toBeInTheDocument()
    expect(field('Entries')).toHaveValue('20') // the panel stays open
  })

  it('changing the expiry to a later date moves an expired row back up (D8, D27)', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(-10) }))
    renderApp()
    const summary = await screen.findByText('Finished (1)')
    expect(screen.queryByRole('list', { name: 'Passes' })).not.toBeInTheDocument()
    await user.click(summary)
    await user.click(screen.getByRole('button', { name: /show details/ }))
    await user.clear(field('Expiry'))
    await user.type(field('Expiry'), day(60))
    await user.click(document.body)

    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('10 / 10')
    expect(screen.queryByText(/Finished/)).not.toBeInTheDocument()
  })

  it('a new gym name makes a gym; an existing one is reused', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    const { ref } = await repo.findOrCreateGym('Zig Zag Wall')
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))

    await user.clear(field('Gym'))
    await user.type(field('Gym'), 'Brand New Gym')
    await user.click(document.body)
    await waitFor(async () =>
      expect((await repo.listUserGyms()).map((g) => g.name).sort()).toEqual([
        'Brand New Gym',
        'Zig Zag Wall',
      ]),
    )

    // the panel stays open after a save
    await user.clear(field('Gym'))
    await user.type(field('Gym'), 'zig zag WALL')
    await user.click(document.body)
    await waitFor(async () => expect((await repo.getPass(pass.id))?.gymRef).toEqual(ref))
    expect(await repo.listUserGyms()).toHaveLength(2)
  })

  it('changing the type to a membership with no entries makes it unlimited', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.selectOptions(field('Type'), 'membership')
    expect(field('Entries per month')).toHaveValue('') // the 10 entries are not carried over
    await user.click(document.body)
    expect(await screen.findByText('Unlimited')).toBeInTheDocument()
  })

  it('reports every problem at once and saves nothing until they are fixed', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ comments: 'keep' }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.clear(field('Gym'))
    await user.clear(field('Entries'))
    await user.type(field('Entries'), '0')
    await user.type(field('Already used'), 'x')
    await user.clear(field(/^Comments/))
    await user.click(document.body)

    expect(await within(panel()).findByText('Enter a gym name')).toBeInTheDocument()
    expect(within(panel()).getByText('Entries must be at least 1')).toBeInTheDocument()
    expect(within(panel()).getByText('Enter a whole number')).toBeInTheDocument()
    expect(field('Entries')).toHaveAttribute('aria-invalid', 'true')
    expect((await repo.getPass(pass.id))?.comments).toBe('keep') // nothing saved, not even the valid box

    await user.type(field('Gym'), 'Zig Zag Wall')
    expect(within(panel()).queryByText('Enter a gym name')).not.toBeInTheDocument()
    expect(within(panel()).getByText('Entries must be at least 1')).toBeInTheDocument()
  })

  it('Done keeps a valid edit and stays open on a half-finished one', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.type(field(/^Comments/), 'kept')
    await user.click(within(panel()).getByRole('button', { name: 'Done' }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument(),
    )
    await waitFor(async () => expect((await repo.getPass(pass.id))?.comments).toBe('kept'))

    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.clear(field('Entries'))
    await user.type(field('Entries'), '0')
    await user.click(within(panel()).getByRole('button', { name: 'Done' }))
    // Nothing is thrown away: the panel stays open and says what is wrong.
    expect(within(panel()).getByText('Entries must be at least 1')).toBeInTheDocument()
    expect(totalOf(await repo.getPass(pass.id))).toBe(10)
  })

  it('leaving the panel with nothing changed writes nothing', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(field('Entries'))
    await user.click(document.body)
    expect((await repo.getPass(pass.id))?.updatedAt).toBe(pass.updatedAt)
  })

  it('tapping another row saves a valid edit on the first one', async () => {
    const user = userEvent.setup()
    const second = await repo.createPass(multipass({ expiryDate: day(60), totalEntries: 20 }))
    await later()
    await repo.createPass(multipass({ expiryDate: day(50), comments: 'first' })) // listed first
    renderApp()
    await waitFor(async () => expect(await mainRows()).toHaveLength(2))
    const [firstToggle, secondToggle] = screen.getAllByRole('button', { name: /show details/ })
    await user.click(firstToggle!)
    await user.type(field(/^Comments/), ' edited')
    await user.click(secondToggle!)
    await waitFor(async () =>
      expect((await repo.listPasses()).map((p) => p.comments)).toContain('first edited'),
    )
    expect(field('Entries')).toHaveValue(String(totalOf(await repo.getPass(second.id))))
  })

  it('a − tap while the panel is open updates the untouched boxes and keeps what is being typed', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.type(field(/^Comments/), 'my note')
    expect(field('Already used this month')).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: /^Use one entry/ }))
    await waitFor(() => expect(field('Already used this month')).toHaveValue('1'))
    expect(field(/^Comments/)).toHaveValue('my note')
  })

  it('+6 and +12 months count from the purchase date in the panel', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ purchaseDate: '2026-01-31', expiryDate: '2026-12-31' }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(within(panel()).getByRole('button', { name: '+6 months' }))
    expect(field('Expiry')).toHaveValue('2026-07-31')
    await user.click(within(panel()).getByRole('button', { name: '+12 months' }))
    expect(field('Expiry')).toHaveValue('2027-01-31')
  })
})

describe('monthly memberships', () => {
  it('sets the entries already used this month and the reset day, and the row follows', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    expect(await screen.findByText('8 / 8')).toBeInTheDocument()
    await user.clear(field('Already used this month'))
    await user.type(field('Already used this month'), '5')
    await user.click(document.body)
    expect(await screen.findByText('3 / 8')).toBeInTheDocument()

    await user.clear(field(/^Reset day/))
    await user.type(field(/^Reset day/), '28')
    await user.click(document.body)
    await waitFor(() => expect(screen.getByText(/resets 28 /)).toBeInTheDocument())
  })

  it('refuses more used this month than the allowance', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.type(field('Already used this month'), '{Backspace}9')
    await user.click(document.body)
    expect(
      await within(panel()).findByText('Cannot be more than the entries per month'),
    ).toBeInTheDocument()
  })
})

describe('deleting', () => {
  it('asks first, and Cancel keeps the pass', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(within(panel()).getByRole('button', { name: 'Delete this pass' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await repo.getPass(pass.id)).toBeDefined()
  })

  it('deleting removes the row, its uses and its freezes', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await repo.useEntry(pass.id, today)
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(within(panel()).getByRole('button', { name: 'Delete this pass' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText(/No passes yet/)).toBeInTheDocument()
    expect(await repo.getPass(pass.id)).toBeUndefined()
    expect(await repo.listUses(pass.id)).toEqual([])
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()
  })

  it('works for a row in Finished', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(-10) }))
    renderApp()
    await user.click(await screen.findByText('Finished (1)'))
    await user.click(screen.getByRole('button', { name: /show details/ }))
    await user.click(within(panel()).getByRole('button', { name: 'Delete this pass' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.queryByText(/Finished/)).not.toBeInTheDocument())
  })
})

describe('the Moved to Finished notice', () => {
  const use = () => screen.getByRole('button', { name: /^Use one entry/ })

  it('appears when − uses the last entry, and Undo brings the row back', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 9 }))
    renderApp()
    await screen.findByText('1 / 10')
    await user.click(use())

    const notice = await screen.findByText(/moved to Finished/)
    expect(notice).toHaveTextContent(`${BOULDER.name}, Multipass moved to Finished`)
    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('1 / 10')).toBeInTheDocument()
    expect(screen.queryByText(/Finished/)).not.toBeInTheDocument()
  })

  it('is not shown for the other − taps', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 5 }))
    renderApp()
    await screen.findByText('5 / 10')
    await user.click(use())
    await screen.findByText('4 / 10')
    expect(screen.queryByText(/moved to Finished/)).not.toBeInTheDocument()
  })

  it('is not shown for a monthly membership, which stays in the list at 0', async () => {
    const user = userEvent.setup()
    await repo.createPass(monthly({ monthlyEntries: 1 }))
    renderApp()
    await screen.findByText('1 / 1')
    await user.click(use())
    await screen.findByText('0 / 1')
    expect(screen.queryByText(/moved to Finished/)).not.toBeInTheDocument()
  })

  it('is shown for a single entry', async () => {
    const user = userEvent.setup()
    await repo.createPass({
      gymRef,
      passType: 'single_entry',
      priceCents: null,
      comments: null,
      purchaseDate: today,
      expiryDate: null,
      totalEntries: 1,
      initialUsed: 0,
    } as PassInput)
    renderApp()
    await screen.findByText('1 / 1')
    await user.click(use())
    expect(await screen.findByText(/moved to Finished/)).toBeInTheDocument()
  })

  it('goes away when the entry is given back with + in Finished', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 9 }))
    renderApp()
    await screen.findByText('1 / 10')
    await user.click(use())
    await screen.findByText(/moved to Finished/)
    await user.click(await screen.findByText('Finished (1)'))
    await user.click(screen.getByRole('button', { name: /^Give one entry back/ }))
    await waitFor(() => expect(screen.queryByText(/moved to Finished/)).not.toBeInTheDocument())
  })

  it('a double tap on the last entry shows one notice and uses one entry', async () => {
    await repo.createPass(multipass({ initialUsed: 9 }))
    renderApp()
    await screen.findByText('1 / 10')
    const button = use()
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByText(/moved to Finished/)
    expect(screen.getAllByText(/moved to Finished/)).toHaveLength(1)
    expect(await repo.listUses((await repo.listPasses())[0]!.id)).toHaveLength(1)
  })
})

describe('save confirmation', () => {
  it('says Saved after a change is saved, and clears when editing again', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    expect(within(panel()).queryByText('Saved')).not.toBeInTheDocument()
    await user.type(field(/^Comments/), 'note')
    await user.tab()
    await user.click(within(panel()).getByRole('heading', { name: /^Details:/ }))
    expect(await within(panel()).findByText('Saved')).toBeInTheDocument()
    await waitFor(async () => expect((await repo.getPass(pass.id))?.comments).toBe('note'))
    await user.type(field(/^Comments/), 'x')
    expect(within(panel()).queryByText('Saved')).not.toBeInTheDocument()
  })
})

describe('save confirmation after a quick expiry button', () => {
  it('saves and says Saved when the person taps away, even if focus never left', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(within(panel()).getByRole('button', { name: '+12 months' }))
    // A phone does not move focus to a tapped button, so no blur comes: only the press.
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Passes' }))
    expect(await within(panel()).findByText('Saved')).toBeInTheDocument()
    await waitFor(async () => expect((await repo.getPass(pass.id))?.expiryDate).not.toBe(day(100)))
  })
})
