import { act, fireEvent, render, screen } from '@testing-library/react'
import { UndoNotice, type Notice } from './UndoNotice'

const notice: Notice = { key: 1, kind: 'finished', passId: 'p1', what: 'Fitbloc, Multipass' }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('UndoNotice, for an added pass', () => {
  const added: Notice = { key: 2, kind: 'added', passId: 'p2', what: 'Zig Zag Wall, Multipass' }

  it('says what was added, with no Undo', () => {
    render(<UndoNotice notice={added} onUndo={() => {}} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Zig Zag Wall, Multipass added')
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('goes after four seconds, sooner than the one with a button', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={added} onUndo={() => {}} onDismiss={onDismiss} />)
    await tick(3900)
    expect(onDismiss).not.toHaveBeenCalled()
    await tick(200)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
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

  it('is not held by the pointer: it still goes after eight seconds', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />)
    const box = screen.getByText(/Fitbloc/).closest('div')!
    fireEvent.mouseEnter(box)
    fireEvent.mouseOver(box)
    await tick(8_100)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while a button in it has keyboard focus', async () => {
    const onDismiss = vi.fn()
    render(<UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />)
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    await tick(60_000)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => screen.getByRole('button', { name: 'Undo' }).blur())
    await tick(8_100)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('a focus that was lost when the notice went away does not hold the next one', async () => {
    const onDismiss = vi.fn()
    const { rerender } = render(
      <UndoNotice notice={notice} onUndo={() => {}} onDismiss={onDismiss} />,
    )
    act(() => screen.getByRole('button', { name: 'Undo' }).focus())
    rerender(<UndoNotice notice={null} onUndo={() => {}} onDismiss={onDismiss} />)
    rerender(<UndoNotice notice={{ ...notice, key: 2 }} onUndo={() => {}} onDismiss={onDismiss} />)
    await tick(8_100)
    expect(onDismiss).toHaveBeenCalledTimes(1)
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
