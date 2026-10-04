import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'
import { listenForInstallPrompt } from './env'

const today = todayLocal()
const pass = () =>
  ({
    gymRef: { kind: 'builtin', id: BUILTIN_GYMS[0]!.id },
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: addDays(today, -30),
    expiryDate: addDays(today, 100),
    totalEntries: 10,
    initialUsed: 0,
  }) as PassInput

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

const saved = new Map<string, PropertyDescriptor | undefined>()
function setNavigator(name: string, value: unknown) {
  if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(navigator, name))
  Object.defineProperty(navigator, name, { value, configurable: true })
}
function phone(kind: 'ios' | 'android', extra: { standalone?: boolean; persisted?: boolean } = {}) {
  setNavigator('userAgent', kind === 'ios' ? IPHONE : ANDROID)
  setNavigator('platform', kind === 'ios' ? 'iPhone' : 'Linux armv81')
  setNavigator('maxTouchPoints', 5)
  setNavigator('standalone', extra.standalone ?? false)
  setNavigator('storage', { persisted: async () => extra.persisted ?? false })
}

/** Chrome sending its install prompt: `prompt()` is what our own Install button calls. */
function chromeOffersInstall() {
  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  })
  window.dispatchEvent(event)
  return { prompt, event }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** Gives the screen time to show something that would be wrong, before checking it is not there. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

const prompt = () => screen.queryByRole('region', { name: /designed to be installed/i })

beforeAll(() => listenForInstallPrompt())

beforeEach(async () => {
  await repo.clearAllData()
})

afterEach(() => {
  window.dispatchEvent(new Event('appinstalled')) // forgets any install prompt
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(navigator, name, descriptor)
    else Reflect.deleteProperty(navigator, name)
  }
  saved.clear()
})

describe('the install prompt on the main screen', () => {
  it('is there from the start, before any pass, with the steps on an iPhone', async () => {
    phone('ios')
    renderAt('/')
    expect(await screen.findByText(/No passes yet/)).toBeInTheDocument()
    const region = await screen.findByRole('region', { name: /designed to be installed/i })
    expect(region).toHaveTextContent('keep your entries safely in your phone’s storage')
    expect(region).toHaveTextContent('Add to Home Screen')
    expect(screen.queryByRole('button', { name: 'Install the app' })).not.toBeInTheDocument()
  })

  it('Not now hides it for good, even after the app is opened again', async () => {
    const user = userEvent.setup()
    phone('ios')
    await repo.createPass(pass())
    const first = renderAt('/')
    await user.click(await screen.findByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(prompt()).not.toBeInTheDocument())
    first.unmount()

    renderAt('/')
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(prompt()).not.toBeInTheDocument()
  })

  it('is not shown in the installed app', async () => {
    phone('ios', { standalone: true })
    await repo.createPass(pass())
    renderAt('/')
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(prompt()).not.toBeInTheDocument()
  })

  it('on Android, waits until Chrome offers the install, then the button uses it', async () => {
    const user = userEvent.setup()
    phone('android')
    await repo.createPass(pass())
    renderAt('/')
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(prompt()).not.toBeInTheDocument()

    const { prompt: show, event } = chromeOffersInstall()
    expect(event.defaultPrevented).toBe(true) // Chrome's own bar is kept back for our button
    await user.click(await screen.findByRole('button', { name: 'Install the app' }))
    expect(show).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(prompt()).not.toBeInTheDocument()) // a prompt can be used once
  })

  it('goes away once the app has been installed', async () => {
    phone('android')
    await repo.createPass(pass())
    renderAt('/')
    chromeOffersInstall()
    expect(await screen.findByRole('button', { name: 'Install the app' })).toBeInTheDocument()
    window.dispatchEvent(new Event('appinstalled'))
    await waitFor(() => expect(prompt()).not.toBeInTheDocument())
  })
})

describe('the data status in Settings', () => {
  it('says so when the app is installed', async () => {
    phone('ios', { standalone: true })
    renderAt('/settings')
    expect(await screen.findByText(/Installed as an app/)).toBeVisible()
  })

  it('says so when the browser has promised to keep the data', async () => {
    phone('android', { persisted: true })
    renderAt('/settings')
    expect(await screen.findByText(/promised to keep this data/)).toBeVisible()
  })

  it('warns an iPhone browser tab, with the steps and the backup', async () => {
    phone('ios')
    renderAt('/settings')
    const warning = await screen.findByText(/could be erased by your browser/)
    const box = warning.parentElement!
    expect(box).toHaveTextContent('Safari can erase')
    expect(box).toHaveTextContent('Add to Home Screen')
    expect(box).toHaveTextContent('download a backup file')
  })

  it('warns an Android browser tab, and offers the install button when Chrome has one', async () => {
    phone('android')
    renderAt('/settings')
    expect(await screen.findByText(/could be erased by your browser/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Install the app' })).not.toBeInTheDocument()
    chromeOffersInstall()
    expect(await screen.findByRole('button', { name: 'Install the app' })).toBeVisible()
  })

  it('does not ask the browser for anything, it only reads', async () => {
    const persist = vi.fn(async () => true)
    phone('ios')
    setNavigator('storage', { persisted: async () => false, persist })
    renderAt('/settings')
    await screen.findByText(/could be erased by your browser/)
    expect(persist).not.toHaveBeenCalled()
  })
})
