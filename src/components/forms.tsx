import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

const controlClass =
  'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

interface FieldProps {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

function FieldFrame({
  label,
  error,
  hint,
  id,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined

export function TextField({
  label,
  error,
  hint,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <input
        id={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...input}
      />
    </FieldFrame>
  )
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <select
        id={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  )
}

export function TextAreaField({
  label,
  error,
  hint,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <textarea
        id={id}
        rows={3}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...textarea}
      />
    </FieldFrame>
  )
}
