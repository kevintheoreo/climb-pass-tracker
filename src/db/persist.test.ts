import { requestPersistentStorage } from './persist'

function mockStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
}

afterEach(() => mockStorage(undefined))

describe('requestPersistentStorage', () => {
  it('is false when the browser has no storage API', async () => {
    mockStorage(undefined)
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn()
    mockStorage({ persisted: async () => true, persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks the browser and reports its answer', async () => {
    mockStorage({ persisted: async () => false, persist: async () => true })
    expect(await requestPersistentStorage()).toBe(true)
    mockStorage({ persisted: async () => false, persist: async () => false })
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('swallows errors', async () => {
    mockStorage({
      persisted: async () => {
        throw new Error('boom')
      },
      persist: async () => true,
    })
    expect(await requestPersistentStorage()).toBe(false)
  })
})
