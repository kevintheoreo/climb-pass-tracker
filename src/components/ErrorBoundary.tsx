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
            className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 py-2 text-base font-medium text-white hover:bg-teal-800"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reload the app
          </button>
        </div>
        <details className="text-sm text-slate-600 dark:text-slate-400">
          <summary className="min-h-11 cursor-pointer py-2">Technical details</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack.split('\n').slice(1, 6).join('\n')}` : ''}
          </pre>
        </details>
      </main>
    )
  }
}
