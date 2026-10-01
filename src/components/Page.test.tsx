import { render, screen } from '@testing-library/react'
import { Page } from './Page'

describe('Page', () => {
  it('renders the heading and children and sets the document title', () => {
    render(
      <Page title="Passes">
        <p>Body</p>
      </Page>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Passes' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(document.title).toBe('Passes · Climb Pass Tracker')
  })
})
