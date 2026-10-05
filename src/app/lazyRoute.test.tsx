import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { lazyRoute } from './lazyRoute'

const reload = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  reload.mockReset()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  })
})

function show(load: () => Promise<{ default: () => React.JSX.Element }>) {
  const Screen = lazyRoute(load)
  return render(
    <Suspense fallback={<p>loading</p>}>
      <Screen />
    </Suspense>,
  )
}

describe('lazyRoute', () => {
  it('shows the screen when it downloads', async () => {
    show(() => Promise.resolve({ default: () => <p>the screen</p> }))
    expect(await screen.findByText('the screen')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads the page once when the file is gone (a release happened while the app was open)', async () => {
    show(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem('reloaded-for-update')).toBe('1')
    expect(screen.queryByText('the screen')).not.toBeInTheDocument()
  })

  it('does not reload again if the file is still missing: the error shows instead', async () => {
    sessionStorage.setItem('reloaded-for-update', '1')
    const caught = vi.fn()
    const Screen = lazyRoute(() => Promise.reject(new Error('still missing')))
    class Catch extends (await import('react')).Component<
      { children: React.ReactNode },
      { failed: boolean }
    > {
      state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error: Error) {
        caught(error.message)
      }
      render() {
        return this.state.failed ? <p>error shown</p> : this.props.children
      }
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Catch>
        <Suspense fallback={null}>
          <Screen />
        </Suspense>
      </Catch>,
    )
    expect(await screen.findByText('error shown')).toBeInTheDocument()
    expect(caught).toHaveBeenCalledWith('still missing')
    expect(reload).not.toHaveBeenCalled()
  })

  it('forgets the reload once a screen has downloaded, so a later release can reload again', async () => {
    sessionStorage.setItem('reloaded-for-update', '1')
    show(() => Promise.resolve({ default: () => <p>the screen</p> }))
    expect(await screen.findByText('the screen')).toBeInTheDocument()
    expect(sessionStorage.getItem('reloaded-for-update')).toBeNull()
  })
})
