import type { ReactNode } from 'react'

/** Columns on a wide screen: Gym | Type | Expiry | Left. On a phone each row wraps onto two lines. */
export const WIDE_COLUMNS = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_11.5rem]'

export const controlClass =
  'block w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 disabled:bg-stone-100 disabled:text-stone-600 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:disabled:bg-stone-800 dark:disabled:text-stone-400'

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
      {hint && !error && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
