import type { ReactNode } from 'react'

/** Columns on a wide screen: Gym | Type | Expiry | Left. On a phone each row wraps onto two lines. */
export const WIDE_COLUMNS = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_11.5rem]'

export const controlClass =
  'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-400'

/** A labelled cell of a pass form, with its error message underneath. */
export function Cell({
  label,
  htmlFor,
  error,
  errorId,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string | undefined
  errorId?: string
  hint?: string
  className: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
          {label}
        </label>
      ) : (
        <span className="mb-1 block text-sm font-medium">{label}</span>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
