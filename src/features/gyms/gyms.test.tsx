import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'

const [BOULDER, CLIMBING] = BUILTIN_GYMS as [
  (typeof BUILTIN_GYMS)[number],
  (typeof BUILTIN_GYMS)[number],
]

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

beforeEach(async () => {
  await repo.clearAllData()
})

async function addUserGym(name = 'My Wall', website: string | null = null) {
  return repo.addUserGym({ name, website })
}

describe('Gyms list', () => {
  it('lists the built-in gyms alphabetically with no active passes', async () => {
    renderAt('/gyms')
    await heading('Gyms')
    const links = await screen.findAllByRole('link', { name: /placeholder/i })
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining(BOULDER.name),
      expect.stringContaining(CLIMBING.name),
    ])
    expect(within(links[0]!).getByText('No active passes')).toBeInTheDocument()
  })

  it('shows how many active passes the user has at each gym', async () => {
    const ref = { kind: 'builtin', id: BOULDER.id } as const
    const base = {
      gymRef: ref,
      passType: 'multipass',
      name: '10-Pass',
      priceCents: null,
      notes: null,
      totalEntries: 10,
      initialUsed: 0,
      purchaseDate: '2020-01-01',
    } as const
    await repo.createPass({ ...base, expiryDate: '2099-12-31' })
    await repo.createPass({ ...base, expiryDate: '2099-12-31' })
    await repo.createPass({ ...base, expiryDate: '2020-06-30' }) // expired: not counted
    renderAt('/gyms')
    const row = await screen.findByRole('link', {
      name: new RegExp(BOULDER.name.replace(/[()]/g, '\\$&')),
    })
    expect(within(row).getByText('2 active passes')).toBeInTheDocument()
  })

  it('filters by search and offers to add an unmatched name as your own gym', async () => {
    const user = userEvent.setup()
    renderAt('/gyms')
    const search = await screen.findByLabelText('Search gyms')
    await user.type(search, 'climbing')
    expect(screen.getAllByRole('link', { name: /Sample/ })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Sample Climbing Gym/ })).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'Zig Zag Wall')
    expect(screen.getByText('No gyms match “Zig Zag Wall”.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Add “Zig Zag Wall” as your own gym' }))
    expect(await screen.findByLabelText('Gym name')).toHaveValue('Zig Zag Wall')
  })

  it('marks gyms the user added themselves', async () => {
    await addUserGym('My Wall')
    renderAt('/gyms')
    const row = await screen.findByRole('link', { name: /My Wall/ })
    expect(within(row).getByText(/Added by you/)).toBeInTheDocument()
  })
})

describe('Adding and editing a gym', () => {
  it('adds a gym, tidies the website, and shows it on its page and in the list', async () => {
    const user = userEvent.setup()
    renderAt('/gyms/new')
    await user.type(await screen.findByLabelText('Gym name'), '  My Wall ')
    await user.type(screen.getByLabelText('Website (optional)'), 'example.com')
    await user.click(screen.getByRole('button', { name: 'Add gym' }))

    await heading('My Wall')
    expect(screen.getByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
    expect(await repo.listUserGyms()).toMatchObject([
      { name: 'My Wall', website: 'https://example.com' },
    ])

    await user.click(screen.getByRole('link', { name: '‹ Gyms' }))
    expect(await screen.findByRole('link', { name: /My Wall/ })).toBeInTheDocument()
  })

  it('asks for a name and a valid website instead of saving', async () => {
    const user = userEvent.setup()
    renderAt('/gyms/new')
    await user.click(await screen.findByRole('button', { name: 'Add gym' }))
    expect(await screen.findByText('Enter a name')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Gym name'), 'My Wall')
    await user.type(screen.getByLabelText('Website (optional)'), 'not a web address')
    await user.click(screen.getByRole('button', { name: 'Add gym' }))
    expect(await screen.findByText('Enter a valid web address')).toBeInTheDocument()
    expect(await repo.listUserGyms()).toEqual([])
  })

  it('edits a gym', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/edit`)
    const name = await screen.findByLabelText('Gym name')
    expect(name).toHaveValue('My Wall')
    await user.clear(name)
    await user.type(name, 'Renamed Wall')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await heading('Renamed Wall')
    expect((await repo.getUserGym(gym.id))?.name).toBe('Renamed Wall')
  })

  it('cannot edit a built-in gym', async () => {
    renderAt(`/gyms/user/${BOULDER.id}/edit`)
    expect(await heading('Gym not found')).toBeInTheDocument()
  })
})

describe('Gym page', () => {
  it('shows a built-in gym’s pass options without any price or validity, and no edit or delete', async () => {
    renderAt(`/gyms/builtin/${BOULDER.id}`)
    await heading(BOULDER.name)
    expect(screen.getByText('10-Pass')).toBeInTheDocument()
    expect(screen.getByText(/Multipass · 10 entries/)).toBeInTheDocument()
    expect(screen.getByText('Single entry', { selector: 'p.text-sm' })).toBeInTheDocument()
    expect(screen.queryByText(/S\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/months?/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit gym' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete gym' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Edit / })).not.toBeInTheDocument()
  })

  it('says so when the gym does not exist', async () => {
    renderAt('/gyms/user/missing')
    expect(await heading('Gym not found')).toBeInTheDocument()
  })

  it('deleting a gym removes it and its options, but is refused while it still has passes', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    const ref = { kind: 'user', id: gym.id } as const
    const pass = await repo.createPass({
      gymRef: ref,
      passType: 'multipass',
      name: 'P',
      priceCents: null,
      notes: null,
      totalEntries: 5,
      initialUsed: 0,
      purchaseDate: '2020-01-01',
      expiryDate: '2099-01-01',
    })

    renderAt(`/gyms/user/${gym.id}`)
    await heading('My Wall')
    expect(await screen.findByText('1 active pass')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete gym' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('still has passes')
    expect(await repo.getUserGym(gym.id)).toBeDefined()

    // Remove the pass; the confirmation is still open, so confirming again now works.
    await repo.deletePass(pass.id)
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await heading('Gyms')
    expect(await repo.getUserGym(gym.id)).toBeUndefined()
    expect(screen.queryByRole('link', { name: /My Wall/ })).not.toBeInTheDocument()
  })

  it('can cancel a delete', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}`)
    await user.click(await screen.findByRole('button', { name: 'Delete gym' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Delete gym' })).toBeInTheDocument()
    expect(await repo.getUserGym(gym.id)).toBeDefined()
  })
})

describe('Pass options', () => {
  async function fillOption(
    user: ReturnType<typeof userEvent.setup>,
    fields: { entries?: string; price?: string; validity?: string; comments?: string },
  ) {
    if (fields.entries !== undefined)
      await user.type(await screen.findByLabelText('Number of entries'), fields.entries)
    if (fields.price !== undefined)
      await user.type(screen.getByLabelText(/Price in S\$/), fields.price)
    if (fields.validity !== undefined)
      await user.type(screen.getByLabelText(/Valid for/), fields.validity)
    if (fields.comments !== undefined)
      await user.type(screen.getByLabelText('Comments (optional)'), fields.comments)
  }

  const option = (
    gymId: string,
    overrides: Partial<Parameters<typeof repo.addUserTemplate>[0]> = {},
  ) =>
    repo.addUserTemplate({
      gymRef: { kind: 'user', id: gymId },
      passType: 'multipass',
      totalEntries: 10,
      priceCents: null,
      validityMonths: null,
      billingPeriod: null,
      comments: null,
      ...overrides,
    })

  it('has no name field: the type is the name', async () => {
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/templates/new`)
    await screen.findByLabelText('Type')
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Comments (optional)')).toBeInTheDocument()
  })

  it('adds an option with price, validity and comments to a gym of your own (Q3)', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/templates/new`)
    await fillOption(user, {
      entries: '10',
      price: '$120',
      validity: '6',
      comments: 'Shareable with friends',
    })
    await user.click(screen.getByRole('button', { name: 'Add pass option' }))

    await heading('My Wall')
    expect(await screen.findByText('Multipass')).toBeInTheDocument()
    expect(screen.getByText('10 entries · 6 months · S$120.00')).toBeInTheDocument()
    expect(screen.getByText('Shareable with friends')).toBeInTheDocument()
    const [stored] = await repo.listUserTemplates()
    expect(stored).toMatchObject({
      passType: 'multipass',
      totalEntries: 10,
      priceCents: 12000,
      validityMonths: 6,
      comments: 'Shareable with friends',
    })
    expect(stored).not.toHaveProperty('name')
  })

  it('treats empty or blank comments as none', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/templates/new`)
    await fillOption(user, { entries: '10', comments: '   ' })
    await user.click(screen.getByRole('button', { name: 'Add pass option' }))
    await heading('My Wall')
    expect((await repo.listUserTemplates())[0]?.comments).toBeNull()
  })

  it('can add an option to a built-in gym, shown after the built-in ones', async () => {
    const user = userEvent.setup()
    renderAt(`/gyms/builtin/${BOULDER.id}/templates/new`)
    await fillOption(user, { entries: '5', comments: 'my own' })
    await user.click(screen.getByRole('button', { name: 'Add pass option' }))
    await heading(BOULDER.name)
    const items = (await screen.findAllByRole('listitem')).map((li) => li.textContent ?? '')
    expect(items.findIndex((t) => t.includes('Day pass'))).toBeLessThan(
      items.findIndex((t) => t.includes('my own')),
    )
    expect(screen.getByRole('link', { name: 'Edit Multipass, 5 entries' })).toBeInTheDocument()
  })

  it('tells two options of the same type apart', async () => {
    const gym = await addUserGym('My Wall')
    await option(gym.id, { totalEntries: 10 })
    await option(gym.id, { totalEntries: 20 })
    renderAt(`/gyms/user/${gym.id}`)
    expect(
      await screen.findByRole('link', { name: 'Edit Multipass, 10 entries' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit Multipass, 20 entries' })).toBeInTheDocument()
  })

  it('only asks for what the type needs', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/templates/new`)
    const type = await screen.findByLabelText('Type')
    expect(screen.getByLabelText('Number of entries')).toBeInTheDocument()
    await user.selectOptions(type, 'Class / course pack')
    expect(screen.getByLabelText('Number of sessions')).toBeInTheDocument()
    await user.selectOptions(type, 'Membership')
    expect(screen.queryByLabelText('Number of sessions')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Billing period')).toBeInTheDocument()
    await user.selectOptions(type, 'Single entry')
    expect(screen.queryByLabelText(/Valid for/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Price in S\$/)).toBeInTheDocument()
    expect(screen.getByLabelText('Comments (optional)')).toBeInTheDocument()
  })

  it('explains every problem at once instead of saving', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    renderAt(`/gyms/user/${gym.id}/templates/new`)
    await user.click(await screen.findByRole('button', { name: 'Add pass option' }))
    expect(await screen.findByText('Enter the number of entries')).toBeInTheDocument()

    await fillOption(user, { entries: '2.5', price: 'abc', validity: '1.5' })
    await user.click(screen.getByLabelText('Comments (optional)'))
    await user.paste('x'.repeat(501))
    await user.click(screen.getByRole('button', { name: 'Add pass option' }))
    expect(await screen.findByText('Enter a whole number')).toBeInTheDocument()
    expect(screen.getByText('Enter an amount like 120 or 120.50')).toBeInTheDocument()
    expect(screen.getByText('Enter a whole number of months')).toBeInTheDocument()
    expect(screen.getByText('Keep comments under 500 characters')).toBeInTheDocument()
    expect(await repo.listUserTemplates()).toEqual([])
  })

  it('edits and deletes an option', async () => {
    const user = userEvent.setup()
    const gym = await addUserGym('My Wall')
    const tpl = await option(gym.id, { priceCents: 12050, comments: 'old note' })

    renderAt(`/gyms/user/${gym.id}/templates/${tpl.id}/edit`)
    const price = await screen.findByLabelText(/Price in S\$/)
    expect(price).toHaveValue('120.50')
    const comments = screen.getByLabelText('Comments (optional)')
    expect(comments).toHaveValue('old note')
    await user.clear(price)
    await user.type(price, '99')
    await user.clear(comments)
    await user.type(comments, 'new note')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await heading('My Wall')
    expect(await repo.getUserTemplate(tpl.id)).toMatchObject({
      priceCents: 9900,
      comments: 'new note',
    })
    expect(await screen.findByText('new note')).toBeInTheDocument()

    await user.click(await screen.findByRole('link', { name: /^Edit Multipass/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete pass option' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await heading('My Wall')
    expect(await repo.getUserTemplate(tpl.id)).toBeUndefined()
    await waitFor(() => expect(screen.getByText('No pass options yet.')).toBeInTheDocument())
  })

  it('cannot edit a built-in option or one that belongs to another gym', async () => {
    const gym = await addUserGym('My Wall')
    const other = await addUserGym('Other Wall')
    const tpl = await option(other.id, { passType: 'single_entry', totalEntries: null })
    renderAt(`/gyms/user/${gym.id}/templates/${tpl.id}/edit`)
    expect(await heading('Not found')).toBeInTheDocument()
  })
})
