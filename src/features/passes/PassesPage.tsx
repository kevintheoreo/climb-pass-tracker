import { Page } from '../../components/Page'
import { NewRow } from './NewRow'
import { RowList } from './RowList'
import { usePassRows } from './usePassRows'

export default function PassesPage() {
  const rows = usePassRows()

  if (!rows) return <Page title="Passes" />

  const { active, finished, today, gyms } = rows
  return (
    <Page title="Passes">
      {active.length === 0 && finished.length === 0 && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          No passes yet. Add your first one below.
        </p>
      )}
      {active.length === 0 && finished.length > 0 && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">No active passes.</p>
      )}

      {active.length > 0 && <RowList rows={active} label="Passes" today={today} />}

      <NewRow gyms={gyms} today={today} />

      {finished.length > 0 && (
        <details className="group mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium">
            <span
              aria-hidden="true"
              className="mr-2 inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
            Finished ({finished.length})
          </summary>
          <div className="mt-2">
            <RowList rows={finished} label="Finished passes" today={today} />
          </div>
        </details>
      )}
    </Page>
  )
}
