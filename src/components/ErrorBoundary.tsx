import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches a crash anywhere below it and says so, instead of leaving an empty page. Reading the
 * on-device database during a render (the live queries) throws into here if it fails. The details
 * are shown so they can be copied or screenshotted.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Climb Pass Tracker crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main role="alert" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
        <p className="mb-4 text-base">
          The app hit a problem and stopped. This did not delete anything. Try again, or reload the
          app.
        </p>
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-500 px-4 py-2 text-base font-medium text-ink hover:bg-brand-400"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-base font-medium text-stone-900 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
          >
            Reload the app
          </button>
        </div>
        <details className="text-sm text-stone-600 dark:text-stone-400">
          <summary className="min-h-11 cursor-pointer py-2">Technical details</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack.split('\n').slice(1, 6).join('\n')}` : ''}
          </pre>
        </details>
      </main>
    )
  }
}
