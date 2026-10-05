import { repo } from '../../db'
import { reminderText } from '../../domain/format'
import { dismissalValue, groupByPass, type Reminder } from '../../domain/reminders'
import type { Row } from '../../domain/rows'

/**
 * The reminder banners at the top of the list (FR-7, FR-31, FR-32, FR-59): one per pass, saying
 * what is about to happen to it. Dismissing a banner dismisses everything it says (FR-34), and
 * the row it is about is highlighted in the list (FR-55). Nothing here is a notification: they
 * show only while the app is open.
 */
export function ReminderBanners({ reminders, rows }: { reminders: Reminder[]; rows: Row[] }) {
  const byId = new Map(rows.map((row) => [row.pass.id, row]))
  const shown = groupByPass(reminders).flatMap((group) => {
    const row = byId.get(group.passId)
    if (!row) return []
    const message = `${row.gymName}, ${row.typeLabel}: ${group.shown.map(reminderText).join(' · ')}`
    return [{ group, message }]
  })
  if (shown.length === 0) return null

  return (
    <section aria-label="Reminders" className="mb-4">
      <ul className="flex flex-col gap-2">
        {shown.map(({ group, message }) => (
          <li
            key={group.passId}
            className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg border border-amber-300 bg-amber-50 py-1 pl-4 pr-1 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="min-w-0 flex-1 basis-48 py-2 text-base">{message}</p>
            <button
              type="button"
              aria-label={`Dismiss reminder: ${message}`}
              onClick={() =>
                void repo.dismissReminders(
                  group.all.map((r) => ({ key: r.key, value: dismissalValue(r) })),
                )
              }
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-base font-medium text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
