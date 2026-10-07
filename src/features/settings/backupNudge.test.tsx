import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { db, repo } from '../../db'
import { addDays, formatDate, todayLocal } from '../../domain/dates'
import { relativeTime } from '../../domain/format'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const daysAgo = (days: number) => `${addDays(today, -days)}T12:00:00.000Z`

const multipass = () =>
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

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const nudge = () => screen.queryByRole('region', { name: 'Back up your passes' })
/** Gives the screen time to show something that would be wrong, before checking it is not there. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50))

let downloads: { filename: string; text: string }[] = []

beforeEach(async () => {
  await repo.clearAllData()
  downloads = []
  const blobs = new Map<string, Blob>()
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${blobs.size}`
    blobs.set(url, blob)
    return url
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    void blobs
      .get(this.href)
      ?.text()
      .then((text) => downloads.push({ filename: this.download, text }))
  })
})

afterEach(() => vi.restoreAllMocks())

describe('the backup reminder on the main screen (D47)', () => {
  it('asks when the last backup is 45 days old, and says how long ago', async () => {
    await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(45))
    renderAt()
    const region = await screen.findByRole('region', { name: 'Back up your passes' })
    expect(region).toHaveTextContent('saved only on this phone')
    expect(region).toHaveTextContent(`Your last backup file was ${relativeTime(-45, today)}.`)
  })

  it('does not ask when the last backup was recent', async () => {
    await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(10))
    renderAt()
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('with no backup ever, counts from the first pass', async () => {
    const pass = await repo.createPass(multipass())
    await db.passes.update(pass.id, { createdAt: daysAgo(40) })
    renderAt()
    const region = await screen.findByRole('region', { name: 'Back up your passes' })
    expect(region).toHaveTextContent('You have not downloaded a backup file yet.')
  })

  it('does not ask on a new phone with a new pass', async () => {
    await repo.createPass(multipass())
    renderAt()
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('has nothing to ask about without passes', async () => {
    await repo.setMeta('lastBackupAt', daysAgo(100))
    renderAt()
    expect(await screen.findByText(/No passes yet/)).toBeInTheDocument()
    await settle()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('Download backup file makes the file and the reminder goes away', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(45))
    renderAt()
    const region = await screen.findByRole('region', { name: 'Back up your passes' })
    await user.click(within(region).getByRole('button', { name: 'Download backup file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]!.filename).toBe(`climb-pass-tracker-backup-${today}.json`)
    expect(downloads[0]!.text).toContain(pass.id)
    await waitFor(() => expect(nudge()).not.toBeInTheDocument())
    const { lastBackupAt } = await repo.getBackupState()
    expect(lastBackupAt && Date.now() - Date.parse(lastBackupAt)).toBeLessThan(60_000)
  })

  it('Remind me in a week hides it, for a week', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(45))
    const first = renderAt()
    await user.click(await screen.findByRole('button', { name: 'Remind me in a week' }))
    await waitFor(() => expect(nudge()).not.toBeInTheDocument())
    expect((await repo.getBackupState()).snoozedUntil).toBe(addDays(today, 7))
    first.unmount()

    renderAt() // opened again the next day
    expect(await screen.findByRole('list', { name: 'Passes' })).toBeInTheDocument()
    await settle()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('comes back when the week is over', async () => {
    await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(45))
    await repo.snoozeBackupNudge(addDays(today, -1))
    renderAt()
    expect(await screen.findByRole('region', { name: 'Back up your passes' })).toBeVisible()
  })
})

describe('the last backup in Settings', () => {
  it('says there is none yet, then the date of the one just downloaded', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    expect(await screen.findByText('No backup made yet.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Download backup file' }))
    expect(await screen.findByText(`Last backup: ${formatDate(today)}.`)).toBeVisible()
  })

  it('a backup downloaded in Settings stops the reminder', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass())
    await repo.setMeta('lastBackupAt', daysAgo(45))
    await repo.snoozeBackupNudge(addDays(today, -1))
    renderAt('/settings')
    await user.click(await screen.findByRole('button', { name: 'Download backup file' }))
    await waitFor(async () => expect((await repo.getBackupState()).snoozedUntil).toBeNull())
    expect((await repo.getBackupState()).lastBackupAt).not.toBe(daysAgo(45))
  })
})
