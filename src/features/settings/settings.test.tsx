import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import { DEFAULT_SETTINGS } from '../../domain/settings'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: 12050,
    comments: 'sale, 2 for 1',
    purchaseDate: addDays(today, -30),
    expiryDate: addDays(today, 100),
    totalEntries: 10,
    initialUsed: 0,
    ...overrides,
  }) as PassInput

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <App />
    </MemoryRouter>,
  )
}

const days = () => screen.findByLabelText('Days before expiry')
const low = () => screen.getByLabelText(/^Remind me at this many entries/)

beforeEach(async () => {
  await repo.clearAllData()
})

afterEach(() => vi.restoreAllMocks())

describe('reminder settings', () => {
  it('start at the defaults', async () => {
    renderSettings()
    expect(await days()).toHaveValue('14, 3')
    expect(low()).toHaveValue('2')
    for (const name of [
      'Pass expiring soon',
      'Few entries left',
      'Monthly entries about to reset',
    ]) {
      expect(screen.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()
    }
  })

  it('a switch saves as soon as it is tapped', async () => {
    const user = userEvent.setup()
    renderSettings()
    const few = await screen.findByRole('checkbox', { name: /Few entries left/ })
    await user.click(few)
    expect(few).not.toBeChecked() // flips at once, before the save finishes
    await waitFor(async () => expect((await repo.getSettings()).lowRemindersEnabled).toBe(false))
    expect(few).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Monthly entries about to reset/ }))
    await user.click(screen.getByRole('checkbox', { name: /Pass expiring soon/ }))
    await waitFor(async () => {
      const s = await repo.getSettings()
      expect([s.resetRemindersEnabled, s.expiryRemindersEnabled]).toEqual([false, false])
    })
  })

  it('the days save when you leave the box, biggest first', async () => {
    const user = userEvent.setup()
    renderSettings()
    const box = await days()
    await user.clear(box)
    await user.type(box, '3, 30 7')
    expect((await repo.getSettings()).expiryReminderDays).toEqual([14, 3]) // not yet
    await user.tab()
    await waitFor(async () =>
      expect((await repo.getSettings()).expiryReminderDays).toEqual([30, 7, 3]),
    )
    await waitFor(() => expect(box).toHaveValue('30, 7, 3'))
  })

  it('Enter saves too and keeps focus in the box', async () => {
    const user = userEvent.setup()
    renderSettings()
    const box = await days()
    await user.clear(box)
    await user.type(box, '21{Enter}')
    await waitFor(async () => expect((await repo.getSettings()).expiryReminderDays).toEqual([21]))
    expect(box).toHaveFocus()
  })

  it('an invalid box says what is wrong and saves nothing', async () => {
    const user = userEvent.setup()
    renderSettings()
    const box = await days()
    await user.clear(box)
    await user.type(box, 'soon')
    await user.tab()
    expect(
      await screen.findByText('Enter up to 5 numbers of days from 1 to 365, like 14, 3'),
    ).toBeVisible()
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect((await repo.getSettings()).expiryReminderDays).toEqual(
      DEFAULT_SETTINGS.expiryReminderDays,
    )
    await user.type(box, '{Control>}a{/Control}10')
    expect(screen.queryByText(/Enter up to 5/)).not.toBeInTheDocument()
  })

  it('the entries threshold saves, and rejects 0', async () => {
    const user = userEvent.setup()
    renderSettings()
    await days()
    await user.clear(low())
    await user.type(low(), '0')
    await user.tab()
    expect(await screen.findByText('Enter a number from 1 to 100')).toBeVisible()
    await user.clear(low())
    await user.type(low(), '4')
    await user.tab()
    await waitFor(async () => expect((await repo.getSettings()).lowEntriesThreshold).toBe(4))
  })

  it('goes back to the defaults when all data is deleted', async () => {
    const user = userEvent.setup()
    await repo.updateSettings({ expiryReminderDays: [30], lowEntriesThreshold: 5 })
    renderSettings()
    expect(await days()).toHaveValue('30')
    await user.click(screen.getByRole('button', { name: 'Delete all data on this device' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.getByLabelText('Days before expiry')).toHaveValue('14, 3'))
    expect(low()).toHaveValue('2')
  })
})

describe('backup and deleting', () => {
  it('says the data is only on this device', async () => {
    renderSettings()
    const section = await screen.findByRole('region', { name: 'Backup' })
    expect(section).toHaveTextContent('only on this device')
  })

  it('puts Backup first and Delete everything last, below Reminders and the home screen steps', async () => {
    renderSettings()
    await screen.findByRole('heading', { name: 'Reminders' })
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['Backup', 'Reminders', 'Delete everything'])
    const summary = screen.getByText('Add to your home screen')
    const after = (a: Node, b: Node) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(after(screen.getByRole('heading', { name: 'Reminders' }), summary)).toBeTruthy()
    expect(after(summary, screen.getByRole('heading', { name: 'Delete everything' }))).toBeTruthy()
  })

  it('deleting asks first; Cancel keeps everything', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Delete all data on this device' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await repo.getPass(pass.id)).toBeDefined()
  })

  it('deleting removes passes, the gyms you added and the settings', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await repo.useEntry(pass.id, today)
    await repo.findOrCreateGym('My Own Wall')
    await repo.updateSettings({ lowEntriesThreshold: 9 })
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Delete all data on this device' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(await screen.findByText('All data on this device was deleted.')).toBeVisible()
    expect(await repo.listPasses()).toEqual([])
    expect(await repo.listUserGyms()).toEqual([])
    expect((await repo.getSettings()).lowEntriesThreshold).toBe(
      DEFAULT_SETTINGS.lowEntriesThreshold,
    )
  })
})

describe('install and version', () => {
  it('explains how to add the app to the home screen on iPhone and Android, once opened', async () => {
    const user = userEvent.setup()
    renderSettings()
    const summary = await screen.findByText('Add to your home screen')
    const section = summary.closest('details')!
    // Closed until asked for.
    expect(section).not.toHaveAttribute('open')
    expect(within(section).queryByText('iPhone or iPad (Safari)')).not.toBeVisible()
    await user.click(summary)
    expect(within(section).getByText('iPhone or iPad (Safari)')).toBeVisible()
    expect(within(section).getByText(/Add to Home Screen/)).toBeVisible()
    expect(within(section).getByText('Android (Chrome)')).toBeVisible()
    expect(within(section).getByText(/Install app/)).toBeVisible()
  })

  it('leaves the home screen steps out once the app is installed', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('standalone'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    try {
      renderSettings()
      await screen.findByRole('heading', { name: 'Reminders' })
      expect(screen.queryByText('Add to your home screen')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('shows the app version', async () => {
    renderSettings()
    expect(await screen.findByText(/version \d+\.\d+\.\d+/)).toBeVisible()
  })
})
