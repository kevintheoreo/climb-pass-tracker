import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const nav = () => screen.getByRole('navigation', { name: 'Main' })

describe('App shell', () => {
  it('shows the four tabs and starts on Passes', () => {
    renderAt()
    const links = within(nav()).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Passes', 'History', 'Gyms', 'Settings'])
    expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Passes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('navigates between tabs, marking the current one and updating the title', async () => {
    const user = userEvent.setup()
    renderAt()
    for (const name of ['History', 'Gyms', 'Settings', 'Passes']) {
      await user.click(within(nav()).getByRole('link', { name }))
      expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()
      expect(within(nav()).getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
      expect(document.title).toBe(`${name} · Climb Pass Tracker`)
    }
    expect(within(nav()).getByRole('link', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('opens deep links directly', () => {
    renderAt('/gyms')
    expect(screen.getByRole('heading', { level: 1, name: 'Gyms' })).toBeInTheDocument()
  })

  it('sends unknown paths to Passes', () => {
    renderAt('/no/such/page')
    expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
  })
})
