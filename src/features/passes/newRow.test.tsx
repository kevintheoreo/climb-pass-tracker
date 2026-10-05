import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'

const today = todayLocal()
const inMonths = (m: number) => {
  const [y, mo, d] = today.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, mo - 1 + m, 1))
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(d, last))
  return date.toISOString().slice(0, 10)
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

const gymBox = () => screen.findByRole('combobox', { name: 'Gym' })
const typeSelect = () => screen.getByLabelText('Type')
const entriesBox = () => screen.getByLabelText(/^Entries/)
const expiryBox = () => screen.getByLabelText(/^Expiry/)
const priceBox = () => screen.getByLabelText(/^Price paid/)
const mainRows = async () =>
  Array.from((await screen.findByRole('list', { name: 'Passes' })).children) as HTMLElement[]

beforeEach(async () => {
  await repo.clearAllData()
})

describe('the blank row', () => {
  it('is on screen with no passes, and says to add one', async () => {
    renderApp()
    expect(await gymBox()).toBeInTheDocument()
    expect(screen.getByText(/No passes yet/)).toBeInTheDocument()
    expect(typeSelect()).toHaveValue('multipass')
  })

  it('Enter on an unfinished row saves nothing; once complete, it saves', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Fitbloc')
    await user.type(entriesBox(), '10{Enter}')
    // not complete yet: Enter alone must not save
    expect(await repo.listPasses()).toEqual([])
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    expect(await screen.findByRole('combobox', { name: 'Gym' })).toHaveValue('')
  })
})

describe('hiding the blank row', () => {
  const pass = () => ({
    gymRef: { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const,
    passType: 'multipass' as const,
    priceCents: null,
    comments: null,
    purchaseDate: addDays(today, -30),
    expiryDate: addDays(today, 100),
    totalEntries: 10,
    initialUsed: 3,
  })

  it('shows a button instead of the row once there is an active pass', async () => {
    await repo.createPass(pass())
    renderApp()
    expect(await screen.findByRole('button', { name: 'Add a pass' })).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Gym' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'New pass' })).not.toBeInTheDocument()
  })

  it('the button opens the row and puts the cursor in the gym cell', async () => {
    const user = userEvent.setup()
    await repo.createPass(pass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    expect(await gymBox()).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Add a pass' })).not.toBeInTheDocument()
  })

  it('Cancel puts the button back, with the focus, and keeps nothing', async () => {
    const user = userEvent.setup()
    await repo.createPass(pass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    await user.type(await gymBox(), 'Half typed')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('combobox', { name: 'Gym' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a pass' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Add a pass' }))
    expect(await gymBox()).toHaveValue('')
    expect(await repo.listPasses()).toHaveLength(1)
  })

  it('has no Cancel button while it is the only way to add a first pass', async () => {
    renderApp()
    await gymBox()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add pass' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a pass' })).not.toBeInTheDocument()
  })

  it('is shown when every pass is finished', async () => {
    await repo.createPass({ ...pass(), totalEntries: 1, initialUsed: 1 })
    renderApp()
    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()
    expect(await gymBox()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a pass' })).not.toBeInTheDocument()
  })

  it('goes away by itself when the first pass is saved', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('button', { name: 'Add a pass' })).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Gym' })).not.toBeInTheDocument()
  })
})

describe('the optional price (D44)', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '10')
    await user.type(expiryBox(), inMonths(6))
  }

  it('is on the blank row, marked optional and empty', async () => {
    renderApp()
    await gymBox()
    expect(priceBox()).toHaveValue('')
    expect(screen.getByText('Price paid (S$, optional)')).toBeVisible()
  })

  it('is saved with the pass', async () => {
    const user = userEvent.setup()
    renderApp()
    await fill(user)
    await user.type(priceBox(), '120.5{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    expect((await repo.listPasses())[0]?.priceCents).toBe(12050)
  })

  it('can be left empty: the pass is saved with no price', async () => {
    const user = userEvent.setup()
    renderApp()
    await fill(user)
    await user.keyboard('{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    expect((await repo.listPasses())[0]?.priceCents).toBeNull()
  })

  it('a price that is not an amount stops the save and says so', async () => {
    const user = userEvent.setup()
    renderApp()
    await fill(user)
    await user.type(priceBox(), 'cheap{Enter}')
    expect(await screen.findByText('Enter an amount like 120 or 120.50')).toBeVisible()
    expect(await repo.listPasses()).toEqual([])
    await user.clear(priceBox())
    await user.keyboard('{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
  })

  it('is empty again the next time the blank row is opened', async () => {
    const user = userEvent.setup()
    renderApp()
    await fill(user)
    await user.type(priceBox(), '99{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    await gymBox()
    expect(priceBox()).toHaveValue('')
  })
})

describe('feedback when a pass is added (D46)', () => {
  const scrolled = vi.fn()
  beforeEach(() => {
    scrolled.mockClear()
    Element.prototype.scrollIntoView = scrolled
  })

  const addOne = async (user: ReturnType<typeof userEvent.setup>, gym = 'Zig Zag Wall') => {
    await user.type(await gymBox(), gym)
    await user.type(entriesBox(), '10')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')
  }

  it('a notice says what was added', async () => {
    const user = userEvent.setup()
    renderApp()
    await addOne(user)
    const notice = await screen.findByText('Zig Zag Wall, Multipass')
    expect(notice.closest('[role="status"]')).toHaveTextContent('Zig Zag Wall, Multipass added')
  })

  it('the notice uses the name of the gym that was matched, not how it was typed', async () => {
    const user = userEvent.setup()
    await repo.findOrCreateGym('Zig Zag Wall')
    renderApp()
    await addOne(user, 'zig zag WALL')
    expect(await screen.findByText('Zig Zag Wall, Multipass')).toBeVisible()
  })

  it('the new row is marked, glows and is scrolled into view', async () => {
    const user = userEvent.setup()
    renderApp()
    await addOne(user)
    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('Just added.')
    expect(row).toHaveClass('ring-amber-400')
    await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(1))
    expect(scrolled.mock.contexts[0]).toBe(row)
  })

  it('only the newest pass is marked when another one is added', async () => {
    const user = userEvent.setup()
    renderApp()
    await addOne(user, 'First Wall')
    await screen.findByText('First Wall, Multipass')
    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    await addOne(user, 'Second Wall')
    await screen.findByText('Second Wall, Multipass')
    const rows = await waitFor(async () => {
      const found = await mainRows()
      expect(found).toHaveLength(2)
      return found
    })
    expect(rows[0]).toHaveTextContent('Second Wall')
    expect(rows[0]).toHaveTextContent('Just added.')
    expect(rows[1]).not.toHaveTextContent('Just added.')
  })

  it('a pass that does not save gives no notice', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.keyboard('{Enter}') // entries and expiry are missing
    expect(await screen.findByText('Enter the number of entries')).toBeVisible()
    expect(screen.queryByText(/ added$/)).not.toBeInTheDocument()
  })
})

describe('saving', () => {
  it('Enter saves a complete row, makes a new gym, shows the row and empties the blank row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), '  Fitbloc   Dempsey ')
    await user.type(entriesBox(), '10')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')

    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('Fitbloc Dempsey')
    expect(row).toHaveTextContent('Multipass')
    expect(row).toHaveTextContent('10 / 10')
    expect((await repo.listUserGyms()).map((g) => g.name)).toEqual(['Fitbloc Dempsey'])
    // With a pass on the list the blank row goes back behind its button, which has the focus.
    expect(screen.queryByRole('combobox', { name: 'Gym' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a pass' })).toHaveFocus()
  })

  it('does not save when focus leaves a complete row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(12))
    expect(await repo.listPasses()).toEqual([]) // still inside the row
    await user.tab() // the +6 months button: still the same row
    await user.tab()
    await user.tab()
    await user.tab() // the Add pass button: still the same row
    await user.tab() // out of the row
    await user.click(document.body) // and a press outside it
    await new Promise((r) => setTimeout(r, 100))
    expect(await repo.listPasses()).toEqual([]) // nothing is saved by leaving
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('moving between the cells does not save or complain', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.tab()
    await user.tab()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await repo.listPasses()).toEqual([])
  })

  it('Add pass on an unfinished row saves nothing and says what is missing, all at once', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.click(screen.getByRole('button', { name: 'Add pass' }))
    expect(await screen.findByText('Enter the number of entries')).toBeInTheDocument()
    expect(screen.getByText('Enter an expiry date')).toBeInTheDocument()
    expect(await repo.listPasses()).toEqual([])
    expect(await repo.listUserGyms()).toEqual([]) // no stray gym either
    expect(entriesBox()).toHaveAttribute('aria-invalid', 'true')
  })

  it('leaving the untouched blank row says nothing', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await gymBox())
    await user.click(document.body)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a message goes away when its cell is edited', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.click(screen.getByRole('button', { name: 'Add pass' }))
    expect(await screen.findByText('Enter the number of entries')).toBeInTheDocument()
    await user.type(entriesBox(), '1')
    expect(screen.queryByText('Enter the number of entries')).not.toBeInTheDocument()
    expect(screen.getByText('Enter an expiry date')).toBeInTheDocument()
  })

  it('an expiry in the past is refused', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), addDays(today, -1))
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Expiry date cannot be before today')).toBeInTheDocument()
    expect(await repo.listPasses()).toEqual([])
  })

  it('pressing Enter twice quickly adds one pass', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(await repo.listPasses()).toHaveLength(1)
  })

  it('two packs at one gym are two separate rows', async () => {
    const user = userEvent.setup()
    renderApp()
    for (const entries of ['10', '20']) {
      if (entries === '20')
        await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
      await user.type(await gymBox(), 'Zig Zag Wall')
      await user.type(entriesBox(), entries)
      await user.type(expiryBox(), inMonths(6))
      await user.keyboard('{Enter}')
      await waitFor(async () =>
        expect((await repo.listPasses()).length).toBe(entries === '10' ? 1 : 2),
      )
    }
    // The screen follows the database a moment later.
    await waitFor(async () => expect(await mainRows()).toHaveLength(2))
    expect(await repo.listUserGyms()).toHaveLength(1)
  })
})

describe('+6 / +12 months', () => {
  it('fill the expiry from today without leaving the row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.click(screen.getByRole('button', { name: '+6 months' }))
    expect(expiryBox()).toHaveValue(inMonths(6))
    await user.click(screen.getByRole('button', { name: '+12 months' }))
    expect(expiryBox()).toHaveValue(inMonths(12))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the gym cell', () => {
  it('suggests matching gyms, ignoring case and punctuation, and fills the cell when one is chosen', async () => {
    const user = userEvent.setup()
    await repo.findOrCreateGym('Boulder+ Clementi')
    renderApp()
    const box = await gymBox()
    await user.type(box, 'boulder+')
    const list = screen.getByRole('listbox')
    expect(within(list).getByRole('option', { name: 'Boulder+ Clementi' })).toBeInTheDocument()
    await user.click(within(list).getByRole('option', { name: 'Boulder+ Clementi' }))
    expect(box).toHaveValue('Boulder+ Clementi')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument() // closed (hidden)
  })

  it('matches on any word', async () => {
    const user = userEvent.setup()
    await repo.findOrCreateGym('Boulder Planet')
    renderApp()
    await user.type(await gymBox(), 'plan')
    expect(screen.getByRole('option', { name: 'Boulder Planet' })).toBeInTheDocument()
  })

  it('offers to add a name that matches nothing, and saves it as a new gym', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Brand New Gym')
    const option = screen.getByRole('option', { name: 'Add “Brand New Gym” as a new gym' })
    await user.click(option)
    expect(await gymBox()).toHaveValue('Brand New Gym')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')
    await waitFor(async () =>
      expect((await repo.listUserGyms()).map((g) => g.name)).toEqual(['Brand New Gym']),
    )
  })

  it('does not offer to add a gym that already exists, and reuses it however it is typed', async () => {
    const user = userEvent.setup()
    const { ref } = await repo.findOrCreateGym('Zig Zag Wall')
    renderApp()
    await user.type(await gymBox(), 'zig  zag WALL')
    expect(screen.queryByRole('option', { name: /as a new gym/ })).not.toBeInTheDocument()
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(6))
    await user.keyboard('{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    expect((await repo.listPasses())[0]?.gymRef).toEqual(ref)
    expect(await repo.listUserGyms()).toHaveLength(1)
  })

  it('works by keyboard: arrows choose, Enter picks without saving, Escape closes', async () => {
    const user = userEvent.setup()
    await repo.findOrCreateGym('Zig Zag Wall')
    await repo.findOrCreateGym('Zig Zag Annex')
    renderApp()
    const box = await gymBox()
    await user.type(entriesBox(), '5') // the rest of the row is complete
    await user.type(expiryBox(), inMonths(6))
    await user.type(box, 'zig')
    expect(box).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant')
    await user.keyboard('{Enter}')
    expect(box).toHaveValue('Zig Zag Wall')
    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(await repo.listPasses()).toEqual([]) // choosing is not "finish the row"
    await user.keyboard('{Enter}') // now Enter finishes the row, with the chosen gym
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    expect(await repo.listUserGyms()).toHaveLength(2) // no stray "zig" gym

    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    const again = await gymBox()
    await user.type(again, 'zig')
    expect(again).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(again).toHaveAttribute('aria-expanded', 'false')
  })

  it('has options at least 44px tall', async () => {
    const user = userEvent.setup()
    await repo.findOrCreateGym('Zig Zag Wall')
    renderApp()
    await user.type(await gymBox(), 'zig')
    expect(screen.getByRole('option', { name: 'Zig Zag Wall' }).className).toContain('min-h-11')
  })
})

describe('the other types', () => {
  it('a single entry has one entry fixed and an optional expiry', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.selectOptions(typeSelect(), 'single_entry')
    expect(entriesBox()).toBeDisabled()
    expect(entriesBox()).toHaveValue('1')
    expect(expiryBox()).toHaveAccessibleName('Expiry (optional)')
    await user.click(await gymBox())
    await user.keyboard('{Enter}')
    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('Single entry')
    expect(row).toHaveTextContent('1 / 1')
    expect(row).toHaveTextContent('No expiry')
  })

  it('a membership with the entries left blank is unlimited', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.selectOptions(typeSelect(), 'membership')
    expect(entriesBox()).toHaveAccessibleName('Entries per month')
    expect(entriesBox()).toHaveAttribute('placeholder', 'Unlimited')
    await user.click(screen.getByRole('button', { name: '+12 months' }))
    await user.click(await gymBox())
    await user.keyboard('{Enter}')
    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('Unlimited')
  })

  it('a membership with entries per month counts the month and shows its reset date', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.selectOptions(typeSelect(), 'membership')
    await user.type(entriesBox(), '8')
    await user.click(screen.getByRole('button', { name: '+12 months' }))
    await user.click(await gymBox())
    await user.keyboard('{Enter}')
    const [row] = await waitFor(async () => {
      const rows = await mainRows()
      expect(rows).toHaveLength(1)
      return rows
    })
    expect(row).toHaveTextContent('8 / 8')
    expect(row).toHaveTextContent(/resets/)
  })

  it('changing the type clears entries that would change meaning, but keeps them between multipass and class pack', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '10')
    await user.selectOptions(typeSelect(), 'class_pack')
    expect(entriesBox()).toHaveValue('10')
    await user.selectOptions(typeSelect(), 'membership')
    expect(entriesBox()).toHaveValue('')
  })
})

describe('the Add pass button', () => {
  const pass = () => ({
    gymRef: { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const,
    passType: 'multipass' as const,
    priceCents: null,
    comments: null,
    purchaseDate: addDays(todayLocal(), -30),
    expiryDate: addDays(todayLocal(), 100),
    totalEntries: 10,
    initialUsed: 3,
  })

  it('saves a complete row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Button Wall')
    await user.type(screen.getByLabelText('Entries', { exact: true }), '5')
    await user.type(screen.getByLabelText(/^Expiry/), addDays(todayLocal(), 90))
    await user.click(screen.getByRole('button', { name: 'Add pass' }))
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
  })

  it('on a blank row says everything that is missing and saves nothing', async () => {
    const user = userEvent.setup()
    renderApp()
    await gymBox()
    await user.click(screen.getByRole('button', { name: 'Add pass' }))
    expect(await screen.findByText('Enter a gym name')).toBeInTheDocument()
    expect(screen.getByText('Enter the number of entries')).toBeInTheDocument()
    expect(screen.getByText('Enter an expiry date')).toBeInTheDocument()
    expect(await repo.listPasses()).toHaveLength(0)
  })

  it('Cancel after filling the row in saves nothing', async () => {
    const user = userEvent.setup()
    await repo.createPass(pass())
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Add a pass' }))
    await user.type(await gymBox(), 'Dropped Wall')
    await user.type(screen.getByLabelText('Entries', { exact: true }), '5')
    await user.type(screen.getByLabelText(/^Expiry/), addDays(todayLocal(), 90))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await repo.listPasses()).toHaveLength(1)
  })
})

describe('a second Enter before the blank row is on screen', () => {
  it('does not add the pass again', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Race Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(6))
    const real = repo.createPassForGymText.bind(repo)
    const spy = vi.spyOn(repo, 'createPassForGymText').mockImplementation(async (...args) => {
      const created = await real(...args)
      // The save is done and the row has not yet been re-drawn blank: press Enter again.
      // (A microtask later, so this call has returned and the save has finished.)
      void Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => Promise.resolve())
        .then(() => {
          fireEvent.keyDown(entriesBox(), { key: 'Enter' })
        })
      return created
    })
    await user.keyboard('{Enter}')
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 100))
    expect(await repo.listPasses()).toHaveLength(1)
    spy.mockRestore()
  })
})
