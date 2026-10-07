import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'
import { DropboxBackup } from './DropboxBackup'
import { signInUrl } from './dropboxApi'
import { readConnection } from './dropboxBackup'
import { fakeDropbox, type FakeDropbox } from './fakeDropbox'

const today = todayLocal()
const pass = (extra: Record<string, unknown> = {}): PassInput =>
  ({
    gymRef: { kind: 'builtin', id: BUILTIN_GYMS[0]!.id },
    passType: 'multipass',
    priceCents: null,
    comments: null,
    purchaseDate: addDays(today, -5),
    expiryDate: addDays(today, 90),
    totalEntries: 10,
    initialUsed: 0,
    ...extra,
  }) as PassInput

let dropbox: FakeDropbox

const renderSettings = (path = '/settings') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(async () => {
  vi.stubEnv('VITE_DROPBOX_APP_KEY', 'test-app-key')
  sessionStorage.clear()
  dropbox = fakeDropbox()
  vi.stubGlobal('fetch', dropbox.fetch)
  await repo.clearAllData()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Back up to Dropbox in Settings (FR-78)', () => {
  it('is not there in a build with no Dropbox app key', async () => {
    vi.stubEnv('VITE_DROPBOX_APP_KEY', '')
    renderSettings()
    await screen.findByRole('heading', { name: 'Back up or move to another device' })
    expect(screen.queryByText(/Dropbox/)).not.toBeInTheDocument()
  })

  it('offers Connect Dropbox, and says where the backup goes and that it is not encrypted', async () => {
    const go = vi.fn()
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <DropboxBackup onRestore={vi.fn()} go={go} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/not encrypted/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Connect Dropbox' }))
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1))
    expect(go.mock.calls[0]![0]).toMatch(/^https:\/\/www\.dropbox\.com\/oauth2\/authorize\?/)
  })

  it('finishes the sign-in when Dropbox sends the person back, and cleans the address', async () => {
    await signInUrl('test-app-key')
    const state = sessionStorage.getItem('dropbox-state')!
    renderSettings(`/settings?code=abc&state=${state}`)
    expect(
      await screen.findByText('Dropbox is connected.', { selector: 'p.text-base' }),
    ).toBeVisible()
    expect(await readConnection()).toMatchObject({ accessToken: 'access-1' })
    expect(screen.getByRole('button', { name: 'Back up now' })).toBeVisible()
    expect(screen.getByText(/No Dropbox backup yet/)).toBeVisible()
  })

  it('ignores a return that did not start here', async () => {
    await signInUrl('test-app-key')
    renderSettings('/settings?code=abc&state=somebody-elses')
    expect(await screen.findByText(/did not start here/)).toBeVisible()
    expect(await readConnection()).toBeNull()
    expect(dropbox.calls.some((c) => c.url.endsWith('/oauth2/token'))).toBe(false)
  })

  it('says so when the person turned Dropbox down', async () => {
    await signInUrl('test-app-key')
    const state = sessionStorage.getItem('dropbox-state')!
    renderSettings(`/settings?error=access_denied&state=${state}`)
    expect(await screen.findByText('Dropbox was not connected.')).toBeVisible()
  })

  async function connected() {
    await signInUrl('test-app-key')
    const state = sessionStorage.getItem('dropbox-state')!
    renderSettings(`/settings?code=abc&state=${state}`)
    await screen.findByRole('button', { name: 'Back up now' })
  }

  it('Back up now saves a backup and shows the date', async () => {
    await repo.createPass(pass())
    await connected()
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(await screen.findByText('Backed up to Dropbox.')).toBeVisible()
    expect(JSON.parse(dropbox.file!).passes).toHaveLength(1)
    expect(await screen.findByText(/Last Dropbox backup: /)).toBeVisible()
  })

  it('shows what went wrong in words', async () => {
    await repo.createPass(pass())
    await connected()
    dropbox.mode = 'full'
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(
      await screen.findByText(/Your Dropbox is full/, { selector: 'p.text-base' }),
    ).toBeVisible()
  })

  it('Restore from Dropbox shows what it would add, then adds it, and the daily backup carries on', async () => {
    const other = await repo.createPass(pass())
    await repo.createPass(pass({ totalEntries: 20 }))
    dropbox.file = JSON.stringify(await repo.exportBackup())
    await repo.deletePass(other.id)
    await connected()
    await userEvent.click(screen.getByRole('button', { name: 'Restore from Dropbox' }))
    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    expect(within(preview).getByText('Backup in Dropbox')).toBeVisible()
    await userEvent.click(within(preview).getByRole('button', { name: 'Add to this device' }))
    expect(await screen.findByText('Done. This device now has:')).toBeVisible()
    expect((await repo.listPasses()).length).toBe(2)
    expect((await readConnection())?.lastBackupAt).not.toBeNull()
  })

  it('asks for a choice when Dropbox already holds a backup from another phone', async () => {
    dropbox.file = '{"x":1}'
    await repo.createPass(pass())
    await connected()
    const { runAutoBackup } = await import('./dropboxBackup')
    await runAutoBackup(today)
    expect(
      await screen.findByText(/already has a backup, probably from another phone/),
    ).toBeVisible()
    expect(dropbox.file).toBe('{"x":1}')
  })

  it('Disconnect forgets the connection but says the backup stays', async () => {
    await connected()
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect Dropbox' }))
    expect(await screen.findByText(/Your backup stays in your Dropbox/)).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Connect Dropbox' })).toBeVisible()
    expect(await readConnection()).toBeNull()
  })

  it('offers to connect again once Dropbox no longer accepts the sign-in', async () => {
    await connected()
    await repo.setMeta('dropbox', {
      ...(await readConnection())!,
      signedOut: true,
      lastError: 'Dropbox signed you out. Connect again to carry on backing up.',
    })
    expect(await screen.findByText('Dropbox needs you to connect again.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Connect Dropbox again' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back up now' })).not.toBeInTheDocument()
  })
})
