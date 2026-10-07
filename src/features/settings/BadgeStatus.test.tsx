import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { useAppBadge } from '../passes/useAppBadge'
import { BadgeStatus } from './BadgeStatus'

type Fake = { setAppBadge?: unknown; clearAppBadge?: unknown }
const nav = navigator as unknown as Fake

afterEach(() => {
  delete nav.setAppBadge
  delete nav.clearAppBadge
})

describe('the icon badge line in Settings (FR-35)', () => {
  it('says when the browser cannot show a badge', () => {
    render(<BadgeStatus />)
    expect(screen.getByText(/this browser cannot show one/)).toBeInTheDocument()
  })

  it('says what the app last set, and what the browser said when it refused', async () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAppBadge(3))
    await waitFor(() => {
      const { unmount } = render(<BadgeStatus />)
      expect(screen.getByText(/last set it to 3/)).toBeInTheDocument()
      unmount()
    })

    nav.setAppBadge = vi.fn().mockRejectedValue(new Error('Permission denied'))
    renderHook(() => useAppBadge(4))
    await waitFor(() => {
      const { unmount } = render(<BadgeStatus />)
      expect(screen.getByText(/refused \(Permission denied\)/)).toBeInTheDocument()
      unmount()
    })
  })
})
