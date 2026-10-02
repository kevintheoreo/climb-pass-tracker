import { act, fireEvent, render, screen } from '@testing-library/react'
import { UndoNotice, type Notice } from './UndoNotice'

const notice: Notice = { key: 1, passId: 'p1', what: 'Fitbloc, Multipass' }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('UndoNotice', () => {
  it('says where the row went and offers Undo', () => {
    const onUndo = vi.fn()
    render(<UndoNotice notice={notice} onUndo={onUndo} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Fitbloc, Multipass moved to Finished')
    screen.getByRole('button', { name: 'Undo' }).click()
    expect(onUndo).toHaveBeenCalledWith(notice)
  })

  it('shows nothing, but keeps its live region, when there is no notice', () => {
    render(<UndoNotice notice={null} onUndo={() => {}} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('dismisses itself after eight seconds, not before', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />)
    await tick(7_900)
    expect(onDismiss).not.toHaveBeenCalled()
    await tick(200)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while it is hovered, then counts the full time again', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />)
    const box = screen.getByText(/Fitbloc/).closest('div')!
    fireEvent.mouseEnter(box)
    await tick(60_000)
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.mouseLeave(box)
    await tick(7_900)
    expect(onDismiss).not.toHaveBeenCalled()
    await tick(200)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while a button in it has keyboard focus', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />)
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    await tick(60_000)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('a newer notice restarts the clock', async () => {
    const onDismiss = vi.fn()
    const { rerender } = render(
      <UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />,
    )
    await tick(6_000)
    rerender(<UndoNotice notice={{ ...notice, key: 2 }} onUndo={() => {}} onDismiss={onDismiss} />)
    await tick(6_000)
    expect(onDismiss).not.toHaveBeenCalled()
    await tick(2_100)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
