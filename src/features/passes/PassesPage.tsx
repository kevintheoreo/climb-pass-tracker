import { useSearchParams } from 'react-router-dom'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import { Page } from '../../components/Page'
import { buttonClass } from '../../components/formUtils'
import { repo } from '../../db'
import { RowList } from './RowList'
import { addSamplePasses } from './sampleData'
import { usePassRows } from './usePassRows'

/** Preview-only tools, shown when the address ends in `?sample`. Removed in step 1.8. */
function SampleTools() {
  return (
    <section
      aria-label="Sample data tools"
      className="mb-4 rounded-lg border border-dashed border-slate-400 p-3 text-sm dark:border-slate-600"
    >
      <p className="mb-2 text-slate-600 dark:text-slate-400">
        Preview only: adding passes by hand comes in a later step.
      </p>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => void addSamplePasses()}
          className={buttonClass('secondary')}
        >
          Add sample passes
        </button>
        <ConfirmDelete
          label="Delete everything on this device"
          prompt="Delete all passes and gyms you added on this device? This can’t be undone."
          onConfirm={() => repo.clearAllData()}
        />
      </div>
    </section>
  )
}

export default function PassesPage() {
  const rows = usePassRows()
  const [params] = useSearchParams()

  if (!rows) return <Page title="Passes" />

  const { active, finished } = rows
  return (
    <Page title="Passes">
      {params.has('sample') && <SampleTools />}

      {active.length === 0 && finished.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">
          No passes yet. They will be added from a blank row here, coming in a later step.
        </p>
      )}
      {active.length === 0 && finished.length > 0 && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">No active passes.</p>
      )}

      {active.length > 0 && <RowList rows={active} label="Passes" />}

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
            <RowList rows={finished} label="Finished passes" />
          </div>
        </details>
      )}
    </Page>
  )
}
