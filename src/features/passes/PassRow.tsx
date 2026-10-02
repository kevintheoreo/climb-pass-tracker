import type { LocalDate } from '../../domain/dates'
import { badgesFor, expiryLabel, relativeDays, resetLabel } from '../../domain/format'
import type { BadgeTone } from '../../domain/format'
import type { Row } from '../../domain/rows'
import type { GymEntry } from '../../domain/gyms'
import { Counter } from './Counter'
import { EditPanel } from './EditPanel'
import { WIDE_COLUMNS } from './fields'

const muted = 'text-slate-600 dark:text-slate-400'

const toneClass: Record<BadgeTone, string> = {
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  muted: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
}

export function PassRow({
  row,
  today,
  gyms,
  open,
  onToggle,
  onClose,
  onUsedLast,
}: {
  row: Row
  today: LocalDate
  gyms: GymEntry[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  onUsedLast?: ((row: Row) => void) | undefined
}) {
  const { status } = row
  const badges = badgesFor(row.pass, status)
  const reset = resetLabel(status)
  const days = row.status.isActive ? row.status.daysLeft : null
  const panelId = `details-${row.pass.id}`

  return (
    <li className={open ? 'bg-slate-50 dark:bg-slate-950' : undefined}>
      {/* A tap anywhere on the row that is not a button opens its details (FR-56). The gym name is
          the keyboard and screen-reader way in. */}
      <div
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea'))
            return
          onToggle()
        }}
        className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 sm:items-center ${WIDE_COLUMNS}`}
      >
        <p className="col-start-1 row-start-1 min-w-0 break-words font-medium">
          <span className="sr-only">Gym: </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`${row.gymName}, ${row.typeLabel}: ${open ? 'hide' : 'show'} details`}
            onClick={onToggle}
            className="inline-flex min-h-11 min-w-11 items-center text-left font-medium"
          >
            {row.gymName}
          </button>
        </p>

        <div className="col-start-2 row-start-1 flex flex-col items-end sm:col-start-4 sm:items-start">
          <Counter row={row} today={today} onUsedLast={onUsedLast} />
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
      </div>

      {open && (
        <div className="px-4 pb-4">
          <EditPanel id={panelId} row={row} gyms={gyms} today={today} onClose={onClose} />
        </div>
      )}
    </li>
  )
}
