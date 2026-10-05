import type { ZodError } from 'zod'

type Variant = 'primary' | 'secondary' | 'danger'

/** Class names for buttons and links that look like buttons. 44px minimum height for touch. */
export function buttonClass(variant: Variant = 'primary'): string {
  const base =
    'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-medium disabled:opacity-50'
  const styles: Record<Variant, string> = {
    primary: 'bg-brand-500 text-ink hover:bg-brand-400',
    secondary:
      'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
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
