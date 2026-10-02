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
    purchaseDate: day(-30),
    expiryDate: day(100),
    totalEntries: 10,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

const membership = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'membership',
    priceCents: null,
    comments: null,
    purchaseDate: day(-5),
    expiryDate: day(200),
    monthlyEntries: null,
    resetDay: null,
    ...overrides,
  }) as PassInput

const use = () => screen.getByRole('button', { name: /^Use one entry/ })
const giveBack = () => screen.getByRole('button', { name: /^Give one entry back/ })

beforeEach(async () => {
  await repo.clearAllData()
})

describe('− and + on a row', () => {
  it('− uses an entry and + gives it back, one at a time', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    expect(await screen.findByText('10 / 10')).toBeInTheDocument()

    await user.click(use())
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
    await user.click(use())
    expect(await screen.findByText('8 / 10')).toBeInTheDocument()
    expect(await repo.listUses(pass.id)).toHaveLength(2)

    await user.click(giveBack())
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
    expect(await repo.listUses(pass.id)).toHaveLength(1)
  })

  it('+ is disabled on a full pass, and works with entries already used before the pass was added', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 2 }))
    renderApp()
    expect(await screen.findByText('8 / 10')).toBeInTheDocument()
    await user.click(giveBack())
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
    await user.click(giveBack())
    expect(await screen.findByText('10 / 10')).toBeInTheDocument()
    expect(giveBack()).toBeDisabled()
    expect(use()).toBeEnabled()
  })

  it('a row’s buttons name the pass, so they tell two rows apart', async () => {
    await repo.createPass(multipass({ expiryDate: day(50) }))
    await repo.createPass(multipass({ expiryDate: day(150) }))
    renderApp()
    const names = (await screen.findAllByRole('button', { name: /^Use one entry/ })).map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(names).toHaveLength(2)
    expect(new Set(names).size).toBe(2)
    expect(names[0]).toContain(BUILTIN_GYMS[0]!.name)
    expect(names[0]).toContain('Multipass')
  })

  it('two passes at one gym count separately', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(50), totalEntries: 10 }))
    await repo.createPass(multipass({ expiryDate: day(150), totalEntries: 20 }))
    renderApp()
    const [first] = await screen.findAllByRole('button', { name: /^Use one entry/ })
    await user.click(first!)
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
    expect(screen.getByText('20 / 20')).toBeInTheDocument()
  })

  it('the count is announced to a screen reader when it changes', async () => {
    await repo.createPass(multipass())
    renderApp()
    const count = (await screen.findByText('10 / 10')).closest('p')!
    expect(count).toHaveAttribute('aria-live', 'polite')
    expect(count).toHaveTextContent('Left: 10 / 10')
  })
})

describe('reaching 0', () => {
  it('using the last entry moves the row to Finished, and + brings it back (D27)', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ totalEntries: 1 }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /^Use one entry/ }))

    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()
    expect(screen.getByText('No active passes.')).toBeInTheDocument()

    await user.click(screen.getByText('Finished (1)'))
    const finished = screen.getByRole('list', { name: 'Finished passes' })
    expect(within(finished).getByText('Used up')).toBeInTheDocument()
    expect(within(finished).getByRole('button', { name: /^Use one entry/ })).toBeDisabled()
    await user.click(within(finished).getByRole('button', { name: /^Give one entry back/ }))

    expect(await screen.findByText('1 / 1')).toBeInTheDocument()
    expect(screen.queryByText(/Finished/)).not.toBeInTheDocument()
  })

  it('a double tap on the last entry counts once and leaves nothing broken', async () => {
    const pass = await repo.createPass(multipass({ totalEntries: 1 }))
    renderApp()
    const button = await screen.findByRole('button', { name: /^Use one entry/ })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()
    expect(await repo.listUses(pass.id)).toHaveLength(1)
  })

  it('− is disabled at 0 on a monthly membership, which stays in the main list with its reset date', async () => {
    const user = userEvent.setup()
    await repo.createPass(membership({ monthlyEntries: 2 }))
    renderApp()
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    await user.click(use())
    await user.click(await screen.findByRole('button', { name: /^Use one entry/ }))
    expect(await screen.findByText('0 / 2')).toBeInTheDocument()

    expect(use()).toBeDisabled()
    expect(giveBack()).toBeEnabled()
    expect(screen.getByText(/^resets \d{1,2} [A-Z][a-z]{2}$/)).toBeInTheDocument()
    expect(screen.queryByText(/Finished/)).not.toBeInTheDocument()

    await user.click(giveBack())
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    expect(use()).toBeEnabled()
  })

  it('a single entry goes from 1 / 1 to Finished when used', async () => {
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
    expect(await screen.findByText('1 / 1')).toBeInTheDocument()
    await user.click(use())
    expect(await screen.findByText('Finished (1)')).toBeInTheDocument()
  })
})

describe('rows with no buttons', () => {
  it('an unlimited membership has none', async () => {
    await repo.createPass(membership())
    renderApp()
    expect(await screen.findByText('Unlimited')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /one entry/ })).not.toBeInTheDocument()
  })

  it('an expired pass has none, even in the Finished section', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(-3), initialUsed: 4 }))
    renderApp()
    await user.click(await screen.findByText('Finished (1)'))
    const finished = screen.getByRole('list', { name: 'Finished passes' })
    expect(within(finished).getByText('Expired – 6 unused')).toBeInTheDocument()
    expect(within(finished).getByText('6 / 10')).toBeInTheDocument()
    expect(
      within(finished).queryByRole('button', { name: /^Use one entry/ }),
    ).not.toBeInTheDocument()
    expect(
      within(finished).queryByRole('button', { name: /^Give one entry back/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps working when a row is deleted just before the tap', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderApp()
    const button = await screen.findByRole('button', { name: /^Use one entry/ })
    await repo.deletePass(pass.id)
    await user.click(button).catch(() => undefined)
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Passes' })).not.toBeInTheDocument(),
    )
  })
})
