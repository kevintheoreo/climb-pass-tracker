import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('About (D54, FR-74)', () => {
  it('the monkey in the header opens it, and the back link returns to the passes', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(await screen.findByRole('link', { name: 'About' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toBeVisible()
    await waitFor(() => expect(document.title).toBe('About · Climb Pass Tracker'))
    await user.click(screen.getByRole('link', { name: 'Back to Passes' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Passes' })).toBeVisible()
  })

  it('names the developer and links to Instagram, the climber quiz and Buy Me a Coffee, each in a new tab', async () => {
    renderAt('/about')
    await screen.findByRole('heading', { level: 1, name: 'About' })
    const instagram = screen.getByRole('link', { name: /@crampingapey/ })
    expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/crampingapey')
    const quiz = screen.getByRole('link', { name: /What type of climber are you\?/ })
    expect(quiz).toHaveAttribute('href', 'https://climbertype.vercel.app/')
    expect(within(quiz).queryByRole('img')).not.toBeInTheDocument() // the logo is decoration
    const coffee = screen.getByRole('link', { name: /Buy me a coffee/ })
    expect(coffee).toHaveAttribute('href', 'https://buymeacoffee.com/Crampingapey')
    for (const link of [instagram, quiz, coffee]) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(within(link).getByText(/opens in a new tab/)).toBeInTheDocument()
    }
    expect(screen.getByText(/^Developed by/)).toBeVisible()
  })

  it('is also linked from Settings, for screens too narrow for the header icon', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    const nav = await screen.findByRole('navigation', { name: 'About and legal' })
    await user.click(within(nav).getByRole('link', { name: 'About' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  })

  it('the privacy policy says the links to other sites send them nothing', async () => {
    renderAt('/privacy')
    expect(await screen.findByRole('heading', { name: 'Links to other sites' })).toBeVisible()
  })
})
