import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'
import { forgetOwnTaps } from './ownTaps'

const today = todayLocal()
const day = (offset: number) => addDays(today, offset)
const afterAMoment = () => new Promise<void>((resolve) => setTimeout(resolve, 5)) // creation times differ

const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const
const GYM = BUILTIN_GYMS[0]!.name

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
    purchaseDate: day(-27),
    expiryDate: day(200),
    monthlyEntries: 8,
    resetDay: null,
    ...overrides,
  }) as PassInput

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const banners = () => screen.queryByRole('region', { name: 'Reminders' })
const mainRows = async () =>
  Array.from((await screen.findByRole('list', { name: 'Passes' })).children) as HTMLElement[]

beforeEach(async () => {
  await repo.clearAllData()
})

describe('banners and your own taps (D42)', () => {
  const useOne = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /^Use one entry/ }))

  it('tapping − down to the low level does not push a banner in; the row still says Low', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 7 })) // 3 left: not low yet
    renderApp()
    await mainRows()
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument()

    await useOne(user) // 2 left: low
    expect(await screen.findByText('2 / 10')).toBeVisible()
    await useOne(user) // 1 left
    expect(await screen.findByText('1 / 10')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument()
    const [row] = await mainRows()
    expect(within(row!).getByText('Low')).toBeVisible()
  })

  it('the banner is there the next time the app is opened', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 7 }))
    const first = renderApp()
    await mainRows()
    await useOne(user)
    expect(await screen.findByText('2 / 10')).toBeVisible()
    first.unmount()

    forgetOwnTaps() // opening the app again
    renderApp()
    expect(await screen.findByText(`${GYM}, Multipass: 2 entries left`)).toBeVisible()
  })

  it('a banner that was already showing when the app was opened stays, and follows the count', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 8 })) // 2 left: low at open
    renderApp()
    expect(await screen.findByText(`${GYM}, Multipass: 2 entries left`)).toBeVisible()
    await useOne(user)
    expect(await screen.findByText(`${GYM}, Multipass: 1 entry left`)).toBeVisible()
  })

  it('only the pass that was tapped is held back: another pass going low on its own still shows', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 7 }))
    renderApp()
    await mainRows()
    await useOne(user)
    expect(await screen.findByText('2 / 10')).toBeVisible()
    await repo.createPass(multipass({ initialUsed: 9, comments: 'other' })) // added elsewhere, low
    expect(await screen.findByText(`${GYM}, Multipass: 1 entry left`)).toBeVisible()
  })

  it('expiring banners are never held back', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 7, expiryDate: day(60) }))
    renderApp()
    await mainRows()
    await useOne(user)
    expect(await screen.findByText('2 / 10')).toBeVisible()
    await repo.updateSettings({ expiryReminderDays: [90, 30] }) // now within the 90-day window
    expect(await screen.findByText(/expires in 60 days/)).toBeVisible()
  })
})

describe('reminder banners', () => {
  it('show nothing when no pass needs attention', async () => {
    await repo.createPass(multipass())
    renderApp()
    await mainRows()
    expect(banners()).not.toBeInTheDocument()
  })

  it('an expiring pass gets a banner and its row is highlighted', async () => {
    await repo.createPass(multipass({ expiryDate: day(150) }))
    await afterAMoment()
    await repo.createPass(multipass({ expiryDate: day(10), totalEntries: 10, initialUsed: 4 })) // on top
    renderApp()
    const region = await screen.findByRole('region', { name: 'Reminders' })
    expect(
      within(region).getByText(`${GYM}, Multipass: expires in 10 days, 6 entries left`),
    ).toBeVisible()
    const [soon, later] = await mainRows()
    expect(within(soon!).getByText(/Has a reminder/)).toBeInTheDocument()
    expect(later).not.toHaveTextContent('Has a reminder')
  })

  it('a pass that is expiring and low gets one banner, and Dismiss clears both', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ expiryDate: day(5), initialUsed: 9 }))
    renderApp()
    const region = await screen.findByRole('region', { name: 'Reminders' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(1)
    expect(
      within(region).getByText(`${GYM}, Multipass: expires in 5 days, 1 entry left`),
    ).toBeVisible()

    await user.click(within(region).getByRole('button', { name: /^Dismiss reminder/ }))
    await waitFor(() => expect(banners()).not.toBeInTheDocument())
    const settings = await repo.getSettings()
    expect(Object.keys(settings.dismissedReminders).sort()).toHaveLength(2) // expiring and low
  })

  it('a pass with few entries left gets a banner', async () => {
    await repo.createPass(multipass({ initialUsed: 8 }))
    renderApp()
    expect(await screen.findByText(`${GYM}, Multipass: 2 entries left`)).toBeVisible()
  })

  it('a monthly membership about to reset gets the reset banner, not the low one (D34)', async () => {
    await repo.createPass(monthly({ monthlyEntries: 2 }))
    renderApp()
    expect(
      await screen.findByText(/entries reset in \d days?|resets? (today|tomorrow)/),
    ).toBeVisible()
    expect(screen.queryByText(/entries left/)).not.toBeInTheDocument()
  })

  it('Dismiss hides the banner and the highlight, and it stays hidden after a reload', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ initialUsed: 8 }))
    const view = renderApp()
    await user.click(await screen.findByRole('button', { name: /^Dismiss reminder/ }))
    await waitFor(() => expect(banners()).not.toBeInTheDocument())
    const [row] = await mainRows()
    expect(row).not.toHaveTextContent('Has a reminder')

    view.unmount()
    renderApp()
    await mainRows()
    expect(banners()).not.toBeInTheDocument()
  })

  it('a dismissed low banner comes back when fewer entries are left', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ initialUsed: 8 }))
    renderApp()
    await user.click(await screen.findByRole('button', { name: /^Dismiss reminder/ }))
    await waitFor(() => expect(banners()).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Use one entry/ }))
    expect(await screen.findByText(`${GYM}, Multipass: 1 entry left`)).toBeVisible()
    expect((await repo.listUses(pass.id)).length).toBe(1)
  })

  it('stay off when the type of reminder is switched off in Settings', async () => {
    await repo.createPass(multipass({ initialUsed: 8, expiryDate: day(10) }))
    await repo.updateSettings({ lowRemindersEnabled: false })
    renderApp()
    expect(await screen.findByText(/expires in 10 days/)).toBeVisible()
    expect(screen.queryByText(`${GYM}, Multipass: 2 entries left`)).not.toBeInTheDocument()
  })

  it('follow the thresholds in Settings', async () => {
    await repo.createPass(multipass({ expiryDate: day(20) }))
    renderApp()
    await mainRows()
    expect(banners()).not.toBeInTheDocument()
    await repo.updateSettings({ expiryReminderDays: [30, 3] })
    expect(await screen.findByText(/expires in 20 days/)).toBeVisible()
  })

  it('Finished passes never get banners', async () => {
    await repo.createPass(multipass({ expiryDate: day(-3) }))
    renderApp()
    await screen.findByText('Finished (1)')
    expect(banners()).not.toBeInTheDocument()
  })

  it('the banner has a 44px Dismiss button', async () => {
    await repo.createPass(multipass({ initialUsed: 8 }))
    renderApp()
    const button = await screen.findByRole('button', { name: /^Dismiss reminder/ })
    expect(button.className).toContain('min-h-11')
  })
})
