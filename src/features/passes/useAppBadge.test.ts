import { renderHook } from '@testing-library/react'
import { useAppBadge } from './useAppBadge'

type Fake = { setAppBadge?: ReturnType<typeof vi.fn>; clearAppBadge?: ReturnType<typeof vi.fn> }
const nav = navigator as unknown as Fake

afterEach(() => {
  delete nav.setAppBadge
  delete nav.clearAppBadge
})

describe('useAppBadge (FR-35)', () => {
  it('shows the count on the icon and follows it', () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ n }) => useAppBadge(n), { initialProps: { n: 2 } })
    expect(nav.setAppBadge).toHaveBeenLastCalledWith(2)
    rerender({ n: 3 })
    expect(nav.setAppBadge).toHaveBeenLastCalledWith(3)
  })

  it('clears the badge at zero', () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAppBadge(0))
    expect(nav.clearAppBadge).toHaveBeenCalledTimes(1)
    expect(nav.setAppBadge).not.toHaveBeenCalled()
  })

  it('leaves the badge alone while the count is not known yet', () => {
    nav.setAppBadge = vi.fn().mockResolvedValue(undefined)
    nav.clearAppBadge = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAppBadge(null))
    expect(nav.setAppBadge).not.toHaveBeenCalled()
    expect(nav.clearAppBadge).not.toHaveBeenCalled()
  })

  it('does nothing, and does not fail, where the browser has no badge', () => {
    expect(() => renderHook(() => useAppBadge(4))).not.toThrow()
  })

  it('ignores a refused badge', async () => {
    nav.setAppBadge = vi.fn().mockRejectedValue(new Error('not allowed'))
    expect(() => renderHook(() => useAppBadge(1))).not.toThrow()
    await Promise.resolve()
  })
})
