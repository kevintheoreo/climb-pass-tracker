import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { BUILTIN_GYMS } from '../../data/gyms'
import { makeTestRepo } from '../../db/testRepo'
import { repo } from '../../db'
import { backupToText, buildBackup, parseBackup } from '../../domain/backup'
import { addDays, todayLocal } from '../../domain/dates'
import type { PassInput } from '../../domain/types'

const today = todayLocal()
const gymRef = { kind: 'builtin', id: BUILTIN_GYMS[0]!.id } as const

const multipass = (overrides: Record<string, unknown> = {}) =>
  ({
    gymRef,
    passType: 'multipass',
    priceCents: null,
    comments: null,
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

/** The backup file another device would have made: a pack with a used entry, and its own gym. */
async function otherDevicesFile() {
  const other = makeTestRepo({ idPrefix: 'other', startSecond: 100 })
  const own = await other.repo.findOrCreateGym('Zig Zag Wall')
  const pack = await other.repo.createPass(multipass({ gymRef: own.ref, totalEntries: 12 }))
  await other.repo.useEntry(pack.id, today)
  await other.repo.updateSettings({ lowEntriesThreshold: 6 })
  return new File([backupToText(await other.repo.exportBackup())], 'from-my-old-phone.json', {
    type: 'application/json',
  })
}

let downloads: { filename: string; text: string; type: string }[] = []

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
    const blob = blobs.get(this.href)
    void blob?.arrayBuffer().then((bytes) => {
      downloads.push({
        filename: this.download,
        text: new TextDecoder().decode(bytes),
        type: blob.type,
      })
    })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const chooseFile = async (user: ReturnType<typeof userEvent.setup>, file: File) => {
  const input = (await screen.findByLabelText('Open a backup file')) as HTMLInputElement
  await user.upload(input, file)
}

describe('downloading a backup', () => {
  it('writes one file with everything, named for today, that the app can read back', async () => {
    const user = userEvent.setup()
    const pass = await repo.createPass(multipass({ comments: 'sale' }))
    await repo.useEntry(pass.id, today)
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Download backup file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    const [file] = downloads
    expect(file!.filename).toBe(`climb-pass-tracker-backup-${today}.json`)
    expect(file!.type).toContain('application/json')
    const parsed = parseBackup(file!.text)
    expect(parsed.ok && parsed.backup.passes).toHaveLength(1)
    expect(parsed.ok && parsed.backup.uses).toHaveLength(1)
    expect(await screen.findByText(/Backup file downloaded \(1 passes\)/)).toBeVisible()
  })

  it('an empty device still makes a valid backup', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Download backup file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(parseBackup(downloads[0]!.text).ok).toBe(true)
  })

  it('explains how to move to another device', async () => {
    renderSettings()
    const section = await screen.findByRole('region', { name: 'Your data' })
    expect(section).toHaveTextContent('Back up or move to another device')
    expect(section).toHaveTextContent('send it to the other device')
    expect(section).toHaveTextContent('There are no accounts')
  })
})

describe('opening a backup file', () => {
  it('shows what it would add before changing anything, then adds it', async () => {
    const user = userEvent.setup()
    await repo.createPass(multipass({ totalEntries: 7 })) // already on this device
    renderSettings()
    await chooseFile(user, await otherDevicesFile())

    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    expect(preview).toHaveTextContent('from-my-old-phone.json')
    expect(within(preview).getByText('1 new pass')).toBeVisible()
    expect(within(preview).getByText('1 recorded use added')).toBeVisible()
    expect(within(preview).getByText('1 new gym')).toBeVisible()
    expect(within(preview).getByText('Reminder settings from the backup')).toBeVisible()
    expect(preview).toHaveTextContent('Passes on this phone stay')
    expect(await repo.listPasses()).toHaveLength(1) // nothing changed yet

    await user.click(within(preview).getByRole('button', { name: 'Add to this device' }))
    await waitFor(async () => expect(await repo.listPasses()).toHaveLength(2))
    expect(await screen.findByText(/Done\. This device now has/)).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
    expect((await repo.getSettings()).lowEntriesThreshold).toBe(6)
    expect((await repo.listUserGyms()).map((g) => g.name)).toEqual(['Zig Zag Wall'])
  })

  it('the passes show up on the main screen', async () => {
    const user = userEvent.setup()
    renderSettings()
    await chooseFile(user, await otherDevicesFile())
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }))
    await screen.findByText(/Done\./)
    await user.click(screen.getByRole('link', { name: /Passes/ }))
    expect(await screen.findByText('11 / 12')).toBeVisible()
    expect(screen.getAllByText('Zig Zag Wall').length).toBeGreaterThan(0)
  })

  it('Cancel changes nothing, and the same file can be chosen again', async () => {
    const user = userEvent.setup()
    renderSettings()
    const file = await otherDevicesFile()
    await chooseFile(user, file)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
    expect(await repo.listPasses()).toEqual([])

    await chooseFile(user, file)
    expect(await screen.findByRole('region', { name: 'Backup preview' })).toBeVisible()
  })

  it('a backup that is already here says so and offers nothing to add', async () => {
    const user = userEvent.setup()
    renderSettings()
    const file = await otherDevicesFile()
    await chooseFile(user, file)
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }))
    await screen.findByText(/Done\./)

    await chooseFile(user, file)
    const preview = await screen.findByRole('region', { name: 'Backup preview' })
    expect(preview).toHaveTextContent('already on this device')
    expect(
      within(preview).queryByRole('button', { name: 'Add to this device' }),
    ).not.toBeInTheDocument()
    await user.click(within(preview).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
  })

  it('adding twice quickly adds once', async () => {
    const user = userEvent.setup()
    renderSettings()
    await chooseFile(user, await otherDevicesFile())
    const add = await screen.findByRole('button', { name: 'Add to this device' })
    await user.dblClick(add)
    await screen.findByText(/Done\./)
    expect(await repo.listPasses()).toHaveLength(1)
    expect((await repo.readSnapshot()).uses).toHaveLength(1)
  })

  describe('files that are not good backups change nothing and say why', () => {
    const refuse = async (file: File, message: RegExp) => {
      // Some file pickers let people choose any file, whatever the input accepts.
      const user = userEvent.setup({ applyAccept: false })
      const before = await repo.readSnapshot()
      renderSettings()
      await chooseFile(user, file)
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.getByRole('alert')).toHaveTextContent('Nothing was imported')
      expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument()
      expect(await repo.readSnapshot()).toEqual(before)
    }

    it('a file that is not a backup', async () => {
      await refuse(
        new File(['hello'], 'notes.txt', { type: 'text/plain' }),
        /not a Climb Pass Tracker backup/,
      )
    })

    it('a spreadsheet export is not a backup', async () => {
      await refuse(
        new File(['Pass ID,Gym\r\n1,Fitbloc\r\n'], 'climb-passes.csv', { type: 'text/csv' }),
        /not a Climb Pass Tracker backup/,
      )
    })

    it('a backup from a newer version of the app', async () => {
      const text = backupToText(buildBackup(await repo.readSnapshot(), '2026-10-04T00:00:00.000Z'))
      const newer = JSON.stringify({ ...JSON.parse(text), version: 99 })
      await refuse(
        new File([newer], 'b.json', { type: 'application/json' }),
        /newer version of the app/,
      )
    })

    it('a backup with a damaged pass, naming it', async () => {
      const other = makeTestRepo({ idPrefix: 'x' })
      await other.repo.createPass(multipass())
      const file = JSON.parse(backupToText(await other.repo.exportBackup()))
      file.passes[0].totalEntries = 0
      await refuse(new File([JSON.stringify(file)], 'b.json'), /pass 1: .*at least 1/i)
    })

    it('a file that is far too big', async () => {
      await refuse(new File([new ArrayBuffer(20_000_001)], 'huge.json'), /too big/)
    })
  })

  it('a refusal goes away when a good file is chosen next', async () => {
    const user = userEvent.setup()
    renderSettings()
    await chooseFile(user, new File(['nope'], 'x.json'))
    await screen.findByRole('alert')
    await chooseFile(user, await otherDevicesFile())
    expect(await screen.findByRole('region', { name: 'Backup preview' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has buttons big enough to tap', async () => {
    renderSettings()
    for (const name of ['Download backup file']) {
      expect((await screen.findByRole('button', { name })).className).toContain('min-h-11')
    }
    expect((await screen.findByText('Open a backup file')).closest('label')!.className).toContain(
      'min-h-11',
    )
  })
})
