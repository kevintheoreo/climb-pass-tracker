import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { useToday } from './useToday'

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts as today’s local date', () => {
    vi.setSystemTime(new Date(2026, 9, 1, 23, 50))
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-10-01')
  })

  it('moves on to the next day after midnight, without a reload', () => {
    vi.setSystemTime(new Date(2026, 9, 1, 23, 58))
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-10-01')

    act(() => {
      vi.setSystemTime(new Date(2026, 9, 2, 0, 1))
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('2026-10-02')
  })

  it('re-checks when the page comes back into view', () => {
    vi.setSystemTime(new Date(2026, 9, 1, 22, 0))
    const { result } = renderHook(() => useToday())
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 2, 8, 0))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-10-02')
  })

  it('stops checking when unmounted', () => {
    const { unmount } = renderHook(() => useToday())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
