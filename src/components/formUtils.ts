import type { ZodError } from 'zod'

type Variant = 'primary' | 'secondary' | 'danger'

/** Class names for buttons and links that look like buttons. 44px minimum height for touch. */
export function buttonClass(variant: Variant = 'primary'): string {
  const base =
    'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-medium disabled:opacity-50'
  const styles: Record<Variant, string> = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800',
    secondary:
      'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  }
  return `${base} ${styles[variant]}`
}

/** First error message per top-level field, for showing next to inputs. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}
