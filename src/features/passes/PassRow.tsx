import { badgesFor, expiryLabel, leftLabel, relativeDays, resetLabel } from '../../domain/format'
import type { BadgeTone } from '../../domain/format'
import type { Row } from '../../domain/rows'

/** Columns on a wide screen: Gym | Type | Expiry | Left. On a phone each row wraps onto two lines. */
export const WIDE_COLUMNS =
  'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]'

const muted = 'text-slate-600 dark:text-slate-400'

const toneClass: Record<BadgeTone, string> = {
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  muted: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
}

export function PassRow({ row }: { row: Row }) {
  const { status } = row
  const badges = badgesFor(row.pass, status)
  const reset = resetLabel(status)
  const days = row.status.isActive ? row.status.daysLeft : null

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 sm:items-center ${WIDE_COLUMNS}`}
    >
      <p className="col-start-1 row-start-1 min-w-0 break-words font-medium">
        <span className="sr-only">Gym: </span>
        {row.gymName}
      </p>

      <div className="col-start-2 row-start-1 text-right sm:col-start-4 sm:text-left">
        <p className="text-lg font-semibold tabular-nums">
          <span className="sr-only">Left: </span>
          {leftLabel(status)}
        </p>
        {reset && <p className={`text-sm ${muted}`}>{reset}</p>}
      </div>

      <p
        className={`col-start-1 row-start-2 text-sm sm:col-start-2 sm:row-start-1 sm:text-base ${muted}`}
      >
        <span className="sr-only">Type: </span>
        {row.typeLabel}
      </p>

      <p
        className={`col-start-2 row-start-2 text-right text-sm sm:col-start-3 sm:row-start-1 sm:text-left sm:text-base ${muted}`}
      >
        <span className="sr-only">Expiry: </span>
        {expiryLabel(row.expiry)}
        {days !== null && <span className="block text-sm">{relativeDays(days)}</span>}
      </p>

      {badges.length > 0 && (
        <ul
          aria-label="Status"
          className="col-span-2 row-start-3 flex flex-wrap gap-1.5 sm:col-span-4 sm:row-start-2"
        >
          {badges.map((badge) => (
            <li
              key={badge.label}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[badge.tone]}`}
            >
              {badge.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
