import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { forgetOwnTaps } from './features/passes/ownTaps'

// Every test starts as a freshly opened app: no taps made yet, nothing showing yet.
beforeEach(() => forgetOwnTaps())
