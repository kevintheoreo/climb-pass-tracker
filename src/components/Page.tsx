import type { ReactNode } from 'react'
import { usePageTitle } from './usePageTitle'

/** Standard screen wrapper: the page heading, and the browser/tab title to match. */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  usePageTitle(title)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6">
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  )
}
