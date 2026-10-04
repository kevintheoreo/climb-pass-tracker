import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: 12000,
    comments: 'note',
    purchaseDate: addDays(today, -30),
    expiryDate: addDays(today, 100),
    totalEntries: 10,
    initialUsed: 3,
    ...overrides,
  }) as PassInput

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await repo.clearAllData()
})

describe('Buy again (FR-21)', () => {
  it('opens the new row with the same gym, type, entries and price, and an empty expiry', async () => {
    await repo.createPass(multipass())
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(screen.getByRole('button', { name: 'Buy again' }))

    const form = await screen.findByRole('form', { name: 'New pass' })
    expect(form).toBeInTheDocument()
    expect(screen.getByLabelText('Gym')).toHaveValue(BUILTIN_GYMS[0]!.name)
    expect(screen.getByLabelText(/^Entries/)).toHaveValue('10')
    expect(screen.getByLabelText(/^Price/)).toHaveValue('120')
    expect(screen.getByLabelText(/^Expiry/)).toHaveValue('')
    // The old row's details are closed.
    expect(screen.queryByRole('region', { name: /^Details:/ })).not.toBeInTheDocument()
  })

  it('adds a second pass once the expiry is filled in, and leaves the old one alone', async () => {
    const old = await repo.createPass(multipass())
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(screen.getByRole('button', { name: 'Buy again' }))
    await user.type(await screen.findByLabelText(/^Expiry/), addDays(today, 200))
    await user.keyboard('{Enter}')

    await waitFor(async () => expect(await repo.listBundles()).toHaveLength(2))
    const bundles = await repo.listBundles()
    const fresh = bundles.find((b) => b.pass.id !== old.id)!.pass
    expect(fresh).toMatchObject({
      passType: 'multipass',
      totalEntries: 10,
      initialUsed: 0,
      priceCents: 12000,
      comments: null,
      purchaseDate: today,
      expiryDate: addDays(today, 200),
    })
    const kept = bundles.find((b) => b.pass.id === old.id)!.pass
    expect(kept).toMatchObject({ initialUsed: 3, expiryDate: addDays(today, 100) })
  })

  it('without an expiry it does not save, and says so', async () => {
    await repo.createPass(multipass())
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /show details/ }))
    await user.click(screen.getByRole('button', { name: 'Buy again' }))
    await user.click(await screen.findByLabelText(/^Price/))
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Enter an expiry date')).toBeInTheDocument()
    expect(await repo.listBundles()).toHaveLength(1)
  })
})
