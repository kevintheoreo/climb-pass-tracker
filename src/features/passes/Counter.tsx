import { NotFoundError, repo } from '../../db'
import { counterView } from '../../domain/counter'
import type { LocalDate } from '../../domain/dates'
import { expiryLabel, leftLabel } from '../../domain/format'
import type { Row } from '../../domain/rows'
import { isMonthly } from '../../domain/types'
import { markTapped } from './ownTaps'

const button =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none disabled:cursor-not-allowed'

/** A row went away (deleted) between the tap and the save: nothing left to do. */
async function ignoreMissing(action: Promise<unknown>) {
  try {
    await action
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
  }
}

/**
 * The Left column: `[−] 7 / 10 [+]` (D25). `−` uses an entry, `+` gives one back. The buttons are
 * disabled at the limits, and left out when a row is inert (an unlimited membership or an expired
 * pass). The rules and the saving are in the domain and repository, so a double tap can't count
 * twice; the screen just reflects the database.
 */
export function Counter({
  row,
  today,
  onUsedLast,
}: {
  row: Row
  today: LocalDate
  /** Called after `−` uses the last entry of a pass, which moves its row to Finished. */
  onUsedLast?: ((row: Row) => void) | undefined
}) {
  const { pass, bundle } = row
  const view = counterView(pass, bundle.uses, bundle.freezes, today)
  const what = `${row.gymName}, ${row.typeLabel}, ${expiryLabel(row.expiry)}`
  // A monthly membership stays in the main list at 0, so only the other passes leave it.
  const lastEntry = !isMonthly(pass) && row.status.entriesLeft === 1

  return (
    <div className="flex items-center gap-1">
      {view.visible && (
        <button
          type="button"
          aria-label={`Use one entry: ${what}`}
          disabled={!view.canUse}
          onClick={() => {
            markTapped(pass.id)
            void ignoreMissing(
              repo.useEntry(pass.id, today).then((result) => {
                if (result.ok && lastEntry) onUsedLast?.(row)
              }),
            )
          }}
          className={`${button} bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-800`}
        >
          <span aria-hidden="true">−</span>
        </button>
      )}
      <p aria-live="polite" className="min-w-16 text-center text-lg font-semibold tabular-nums">
        <span className="sr-only">Left: </span>
        {leftLabel(row.status)}
      </p>
      {view.visible && (
        <button
          type="button"
          aria-label={`Give one entry back: ${what}`}
          disabled={!view.canGiveBack}
          onClick={() => {
            markTapped(pass.id)
            void ignoreMissing(repo.giveBackEntry(pass.id, today))
          }}
          className={`${button} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:text-slate-700 dark:disabled:hover:bg-slate-900`}
        >
          <span aria-hidden="true">+</span>
        </button>
      )}
    </div>
  )
}
