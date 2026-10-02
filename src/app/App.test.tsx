import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('App shell (D23)', () => {
  it('opens on the main screen with a gear icon for Settings and no tab bar', () => {
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
    expect(screen.getByText('Climb Pass Tracker')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(document.title).toBe('Passes · Climb Pass Tracker')
  })

  it('goes to Settings from the gear and back from the back link, updating the title', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Settings · Climb Pass Tracker')

    await user.click(screen.getByRole('link', { name: '‹ Passes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current')
  })

  it('opens Settings directly', () => {
    renderAt('/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('has no Gyms or History screens: those paths go to the main screen', () => {
    for (const path of ['/gyms', '/history', '/no/such/page']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
      unmount()
    }
  })
})
