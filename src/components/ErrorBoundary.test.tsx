import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

let broken = true
function Child() {
  if (broken) throw new Error('database is on fire')
  return <p>all good</p>
}

beforeEach(() => {
  broken = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('shows its children when nothing is wrong', () => {
    broken = false
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says what happened instead of an empty page, with the details to copy', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('alert')).toHaveTextContent('did not delete anything')
    await user.click(screen.getByText('Technical details'))
    expect(screen.getByText(/Error: database is on fire/)).toBeVisible()
  })

  it('Try again shows the app once the problem is gone', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    )
    broken = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('all good')).toBeVisible()
  })

  it('has buttons big enough to tap', () => {
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    )
    for (const name of ['Try again', 'Reload the app']) {
      expect(screen.getByRole('button', { name }).className).toContain('min-h-11')
    }
  })
})
