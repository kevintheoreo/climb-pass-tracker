import type { ReactNode } from 'react'

/** When the privacy policy and the terms were last changed. Update it with any change to them. */
export const LEGAL_UPDATED = 'October 2026'

/** A titled block of a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-base">{children}</div>
    </section>
  )
}

/** The line under a legal page's heading. */
export function LegalUpdated() {
  return (
    <p className="mb-6 text-sm text-stone-600 dark:text-stone-400">Last updated {LEGAL_UPDATED}</p>
  )
}
