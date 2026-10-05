import type { LocalDate } from '../../domain/dates'
import type { GymEntry } from '../../domain/gyms'
import type { PassDraft } from '../../domain/passForm'
import type { Row } from '../../domain/rows'
import { WIDE_COLUMNS } from './fields'
import { PassRow } from './PassRow'
import type { Ghost } from './useRowMotion'

/** A bordered list of rows, with column headings on wide screens. */
export function RowList({
  rows,
  label,
  today,
  gyms,
  openId,
  reminded,
  addedId,
  onToggle,
  onClose,
  onUsedLast,
  onBuyAgain,
  onSaved,
  ghosts = [],
  entering = new Set<string>(),
}: {
  rows: Row[]
  label: string
  today: LocalDate
  gyms: GymEntry[]
  /** The row whose details are open, if it is in this list. */
  openId: string | null
  /** Ids of the passes a reminder banner is about. */
  reminded: Set<string>
  /** The pass that was just added, if it is in this list: it slides in (D57). */
  addedId: string | null
  onToggle: (passId: string) => void
  onClose: () => void
  onUsedLast?: ((row: Row) => void) | undefined
  onBuyAgain: (draft: PassDraft) => void
  onSaved: (row: Row) => void
  /** Rows that just moved to the other list, shown sliding out (FR-61). */
  ghosts?: Ghost[]
  /** Ids of rows that just came from the other list, sliding in. */
  entering?: ReadonlySet<string>
}) {
  // The live rows, with each ghost put back where it was.
  const shown = rows.map((row) => ({ row, ghost: false }))
  for (const g of [...ghosts].sort((a, b) => a.index - b.index))
    shown.splice(Math.min(g.index, shown.length), 0, { row: g.row, ghost: true })
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div
        aria-hidden="true"
        className={`hidden border-b border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 dark:border-stone-800 dark:text-stone-400 sm:grid sm:gap-x-3 ${WIDE_COLUMNS}`}
      >
        <span>Gym</span>
        <span>Type</span>
        <span>Expiry</span>
        <span>Left</span>
      </div>
      <ul aria-label={label} className="divide-y divide-stone-200 dark:divide-stone-800">
        {shown.map(({ row, ghost }) => (
          <PassRow
            key={ghost ? `leaving-${row.pass.id}` : row.pass.id}
            row={row}
            today={today}
            gyms={gyms}
            open={!ghost && openId === row.pass.id}
            highlighted={!ghost && reminded.has(row.pass.id)}
            justAdded={!ghost && addedId === row.pass.id}
            onToggle={() => onToggle(row.pass.id)}
            onClose={onClose}
            onUsedLast={onUsedLast}
            onBuyAgain={onBuyAgain}
            onSaved={onSaved}
            ghost={ghost}
            motion={ghost ? 'leaving' : entering.has(row.pass.id) ? 'entering' : undefined}
          />
        ))}
      </ul>
    </div>
  )
}
