import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
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
    expect(screen.getByRole('combobox', { name: 'Gym' })).toHaveValue('')
    expect(entriesBox()).toHaveValue('')
    expect(expiryBox()).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Gym' })).toHaveFocus()
  })

  it('saves when focus leaves a complete row', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.type(entriesBox(), '5')
    await user.type(expiryBox(), inMonths(12))
    expect(await repo.listPasses()).toEqual([]) // still inside the row
    await user.tab() // the +6 months button: still the same row
    await user.tab()
    await user.tab()
    await user.tab() // out of the row
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(1))
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

  it('leaving an unfinished row saves nothing and says what is missing, all at once', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(await gymBox(), 'Zig Zag Wall')
    await user.click(document.body)
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
    await user.click(document.body)
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

    await user.type(box, 'zig')

    expect(box).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(box).toHaveAttribute('aria-expanded', 'false')
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
