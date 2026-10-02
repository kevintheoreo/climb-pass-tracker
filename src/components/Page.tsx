import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const APP_NAME = 'Climb Pass Tracker'

/** Standard screen wrapper: the page heading, and the browser/tab title to match. */
export function Page({
  title,
  back,
  children,
}: {
  title: string
  /** Shows a "back" link above the heading, for screens inside a tab. */
  back?: { to: string; label: string }
  children?: ReactNode
}) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 mb-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-teal-700 dark:text-teal-300"
        >
          ‹ {back.label}
        </Link>
      )}
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  )
}
