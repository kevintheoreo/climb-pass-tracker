import type { Row } from '../../domain/rows'
import { PassRow, WIDE_COLUMNS } from './PassRow'

/** A bordered list of rows, with column headings on wide screens. */
export function RowList({ rows, label }: { rows: Row[]; label: string }) {
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
          <PassRow key={row.pass.id} row={row} />
        ))}
      </ul>
    </div>
  )
}
