import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { repo } from '../../db'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await repo.clearAllData()
})

describe('privacy policy and terms (FR-48)', () => {
  it('are linked from Settings and open', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    await user.click(await screen.findByRole('link', { name: 'Privacy policy' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
    expect(document.title).toBe('Privacy policy · Climb Pass Tracker')
    await user.click(screen.getByRole('link', { name: 'Back to Settings' }))
    await user.click(await screen.findByRole('link', { name: 'Terms of use' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible()
  })

  it('open from their own addresses, with a date and a way back', async () => {
    renderAt('/privacy')
    expect(await screen.findByText(/^Last updated /)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('the privacy policy says nothing is collected and covers backups and deleting', async () => {
    renderAt('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
    expect(screen.getByText(/collects nothing about you/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Backup files' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Deleting your data' })).toBeVisible()
  })
})
