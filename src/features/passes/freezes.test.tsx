import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, formatDate, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const day = (offset: number) => addDays(today, offset)
const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const

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

const multipass = () =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: day(-30),
    expiryDate: day(100),
    totalEntries: 10,
    initialUsed: 0,
  }) as PassInput

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

const openDetails = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /show details/ }))
  return screen.getByRole('region', { name: /^Details:/ })
}
const row = async () => (await screen.findByRole('list', { name: 'Passes' })).children[0]!
const freezesOf = async (passId: string) =>
  (await repo.listBundles()).find((b) => b.pass.id === passId)!.freezes

beforeEach(async () => {
  await repo.clearAllData()
})

describe('freezes in a membership’s details (FR-20)', () => {
  it('are offered for a membership and not for a multipass', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass())
    renderApp()
    const panel = await openDetails(user)
    expect(within(panel).queryByRole('heading', { name: 'Freezes' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Add a freeze' })).not.toBeInTheDocument()
  })

  it('adding one moves the end date back by its days, and a freeze that includes today shows Frozen', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    renderApp()
    const panel = await openDetails(user)
    expect(await row()).toHaveTextContent(formatDate(day(200)))
    await user.click(within(panel).getByRole('button', { name: 'Add a freeze' }))
    const group = within(panel).getByRole('group', { name: 'Add a freeze' })
    await user.type(within(group).getByLabelText('End'), day(9)) // today to today + 9: 10 days
    await user.click(within(group).getByRole('button', { name: 'Add freeze' }))

    await waitFor(async () => expect(await freezesOf(pass.id)).toHaveLength(1))
    expect(await freezesOf(pass.id)).toMatchObject([{ startDate: today, endDate: day(9) }])
    await waitFor(async () => expect(await row()).toHaveTextContent(formatDate(day(210))))
    expect(await row()).toHaveTextContent('Frozen')
    const item = within(panel).getByRole('listitem', { name: 'Freeze 1' })
    expect(item).toHaveTextContent('10 days')
    expect(within(panel).getByText(/It now ends on/)).toHaveTextContent(formatDate(day(210)))
  })

  it('a freeze in the future moves the end date but does not freeze the pass yet', async () => {
    const user = userEvent.setup()
    await repo.createPass(membership())
    renderApp()
    const panel = await openDetails(user)
    await user.click(within(panel).getByRole('button', { name: 'Add a freeze' }))
    const group = within(panel).getByRole('group', { name: 'Add a freeze' })
    await user.clear(within(group).getByLabelText('Start'))
    await user.type(within(group).getByLabelText('Start'), day(30))
    await user.type(within(group).getByLabelText('End'), day(36)) // 7 days
    await user.click(within(group).getByRole('button', { name: 'Add freeze' }))
    await waitFor(async () => expect(await row()).toHaveTextContent(formatDate(day(207))))
    expect(await row()).not.toHaveTextContent('Frozen')
  })

  it('says what is wrong, all at once, and saves nothing', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    renderApp()
    const panel = await openDetails(user)
    await user.click(within(panel).getByRole('button', { name: 'Add a freeze' }))
    const group = within(panel).getByRole('group', { name: 'Add a freeze' })
    await user.clear(within(group).getByLabelText('Start'))
    await user.click(within(group).getByRole('button', { name: 'Add freeze' }))
    expect(within(group).getByText('Enter a start date')).toBeVisible()
    expect(within(group).getByText('Enter an end date')).toBeVisible()

    await user.type(within(group).getByLabelText('Start'), day(10))
    await user.type(within(group).getByLabelText('End'), day(3))
    await user.click(within(group).getByRole('button', { name: 'Add freeze' }))
    expect(within(group).getByText('End date cannot be before the start date')).toBeVisible()
    expect(within(group).queryByText(/Couldn’t save/)).not.toBeInTheDocument() // stopped before saving
    expect(await freezesOf(pass.id)).toEqual([])
  })

  it('Cancel closes the form without adding anything', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    renderApp()
    const panel = await openDetails(user)
    await user.click(within(panel).getByRole('button', { name: 'Add a freeze' }))
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }))
    expect(within(panel).queryByRole('group', { name: 'Add a freeze' })).not.toBeInTheDocument()
    expect(await freezesOf(pass.id)).toEqual([])
  })

  it('lists the freezes in date order, and two of them add up', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    await repo.addFreeze({ passId: pass.id, startDate: day(40), endDate: day(44) }) // 5 days
    await repo.addFreeze({ passId: pass.id, startDate: day(10), endDate: day(11) }) // 2 days
    renderApp()
    const panel = await openDetails(user)
    const items = within(panel).getAllByRole('listitem', { name: /^Freeze \d/ })
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('2 days') // the earlier freeze first
    expect(items[1]).toHaveTextContent('5 days')
    expect(await row()).toHaveTextContent(formatDate(day(207)))
  })

  it('changing a date saves by itself and the end date follows', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    const freeze = await repo.addFreeze({ passId: pass.id, startDate: day(10), endDate: day(14) })
    renderApp()
    const panel = await openDetails(user)
    expect(await row()).toHaveTextContent(formatDate(day(205)))
    const end = within(panel).getByRole('listitem', { name: 'Freeze 1' })
    await user.clear(within(end).getByLabelText('End'))
    await user.type(within(end).getByLabelText('End'), day(19)) // 10 days now
    await user.click(document.body)
    await waitFor(async () =>
      expect((await freezesOf(pass.id))[0]).toMatchObject({ id: freeze.id, endDate: day(19) }),
    )
    await waitFor(async () => expect(await row()).toHaveTextContent(formatDate(day(210))))
  })

  it('a bad edit is not saved and says why', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    await repo.addFreeze({ passId: pass.id, startDate: day(10), endDate: day(14) })
    renderApp()
    const panel = await openDetails(user)
    const item = within(panel).getByRole('listitem', { name: 'Freeze 1' })
    await user.clear(within(item).getByLabelText('End'))
    await user.type(within(item).getByLabelText('End'), day(5)) // before the start
    await user.click(document.body)
    expect(await within(item).findByText('End date cannot be before the start date')).toBeVisible()
    expect(item).toHaveTextContent('Not saved yet')
    expect((await freezesOf(pass.id))[0]).toMatchObject({ endDate: day(14) })
  })

  it('removing one asks first, then the end date moves back', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership())
    await repo.addFreeze({ passId: pass.id, startDate: day(10), endDate: day(14) })
    renderApp()
    const panel = await openDetails(user)
    await user.click(within(panel).getByRole('button', { name: 'Remove freeze 1' }))
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }))
    expect(await freezesOf(pass.id)).toHaveLength(1)

    await user.click(within(panel).getByRole('button', { name: 'Remove freeze 1' }))
    await user.click(within(panel).getByRole('button', { name: 'Yes, delete' }))
    await waitFor(async () => expect(await freezesOf(pass.id)).toHaveLength(0))
    await waitFor(async () => expect(await row()).toHaveTextContent(formatDate(day(200))))
  })

  it('does not move a monthly membership’s reset day (D32)', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(membership({ monthlyEntries: 8, resetDay: 20 }))
    renderApp()
    const before = /resets \d{1,2} [A-Z][a-z]{2}/.exec((await row()).textContent ?? '')?.[0]
    expect(before).toBeDefined()
    const panel = await openDetails(user)
    await user.click(within(panel).getByRole('button', { name: 'Add a freeze' }))
    const group = within(panel).getByRole('group', { name: 'Add a freeze' })
    await user.type(within(group).getByLabelText('End'), day(20))
    await user.click(within(group).getByRole('button', { name: 'Add freeze' }))
    await waitFor(async () => expect(await freezesOf(pass.id)).toHaveLength(1))
    expect(await row()).toHaveTextContent(before!)
  })
})
