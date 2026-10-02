import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import type { Row } from '../../domain/rows'
import { WIDE_COLUMNS } from './fields'
import { PassRow } from './PassRow'

/** A bordered list of rows, with column headings on wide screens. */
export function RowList({
  rows,
  label,
  today,
  gyms,
  openId,
  reminded,
  onToggle,
  onClose,
  onUsedLast,
}: {
  rows: Row[]
  label: string
  today: LocalDate
  gyms: GymEntry[]
  /** The row whose details are open, if it is in this list. */
  openId: string | null
  /** Ids of the passes a reminder banner is about. */
  reminded: Set<string>
  onToggle: (passId: string) => void
  onClose: () => void
  onUsedLast?: ((row: Row) => void) | undefined
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div
        aria-hidden="true"
        className={`hidden border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:grid sm:gap-x-3 ${WIDE_COLUMNS}`}
      >
        <span>Gym</span>
        <span>Type</span>
        <span>Expiry</span>
        <span>Left</span>
      </div>
      <ul aria-label={label} className="divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((row) => (
          <PassRow
            key={row.pass.id}
            row={row}
            today={today}
            gyms={gyms}
            open={openId === row.pass.id}
            highlighted={reminded.has(row.pass.id)}
            onToggle={() => onToggle(row.pass.id)}
            onClose={onClose}
            onUsedLast={onUsedLast}
          />
        ))}
      </ul>
    </div>
  )
}
