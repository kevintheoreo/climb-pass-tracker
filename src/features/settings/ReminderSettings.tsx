import { useState, type ReactNode } from 'react'
import { repo } from '../../db'
import {
  parseLowThreshold,
  parseReminderDays,
  type Parsed,
  type Settings,
} from '../../domain/settings'
import { Cell, controlClass } from '../passes/fields'

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => Promise<unknown>
}) {
  // Flip at once; the saved value catches up a moment later (and wins if the save fails).
  const [pending, setPending] = useState<boolean | null>(null)
  const [seen, setSeen] = useState(checked)
  if (seen !== checked) {
    setSeen(checked)
    setPending(null)
  }
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        checked={pending ?? checked}
        onChange={(e) => {
          setPending(e.target.checked)
          onChange(e.target.checked).catch(() => setPending(null))
        }}
        className="mt-1 size-6 shrink-0 accent-brand-500"
      />
      <span>
        <span className="block text-base font-medium">{label}</span>
        {hint && <span className="block text-sm text-stone-600 dark:text-stone-400">{hint}</span>}
      </span>
    </label>
  )
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      {children}
    </div>
  )
}

/**
 * Reminder thresholds and switches (FR-33, FR-44). The switches save as they are tapped. A number
 * box saves when it is valid and focus leaves it, or on Enter; an invalid one says what is wrong
 * and is not saved.
 */
export function ReminderSettings({ settings }: { settings: Settings }) {
  const savedDays = settings.expiryReminderDays.join(', ')
  const savedLow = String(settings.lowEntriesThreshold)
  const [days, setDays] = useState(savedDays)
  const [low, setLow] = useState(savedLow)
  const [errors, setErrors] = useState<{ days?: string; low?: string }>({})

  // The saved values changed (this box's own save, or the data was wiped): show them. Boxes keep
  // their focus, because nothing is remounted.
  const [seen, setSeen] = useState({ days: savedDays, low: savedLow })
  if (seen.days !== savedDays || seen.low !== savedLow) {
    if (seen.days !== savedDays) setDays(savedDays)
    if (seen.low !== savedLow) setLow(savedLow)
    setSeen({ days: savedDays, low: savedLow })
  }

  const save = (changes: Partial<Settings>) => repo.updateSettings(changes)

  function commit<T>(
    field: 'days' | 'low',
    parsed: Parsed<T>,
    current: T,
    write: (value: T) => Partial<Settings>,
  ) {
    if (!parsed.ok) {
      setErrors((e) => ({ ...e, [field]: parsed.error }))
      return
    }
    setErrors((e) => ({ ...e, [field]: undefined }))
    if (JSON.stringify(parsed.value) !== JSON.stringify(current)) void save(write(parsed.value))
  }

  const commitDays = () =>
    commit('days', parseReminderDays(days), settings.expiryReminderDays, (v) => ({
      expiryReminderDays: v,
    }))
  const commitLow = () =>
    commit('low', parseLowThreshold(low), settings.lowEntriesThreshold, (v) => ({
      lowEntriesThreshold: v,
    }))
  const onEnter = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    action()
  }

  return (
    <section aria-labelledby="reminders-heading" className="mb-6">
      <h2 id="reminders-heading" className="mb-1 text-lg font-semibold">
        Reminders
      </h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        Reminders show as banners at the top of the list while the app is open. Nothing is sent to
        your phone.
      </p>
      <div className="flex flex-col gap-3">
        <Group>
          <Toggle
            label="Pass expiring soon"
            checked={settings.expiryRemindersEnabled}
            onChange={(expiryRemindersEnabled) => save({ expiryRemindersEnabled })}
          />
          <div className="mt-2">
            <Cell
              label="Days before expiry"
              htmlFor="reminder-days"
              error={errors.days}
              errorId="reminder-days-error"
              hint="One or more numbers, like 14, 3"
              className=""
            >
              <input
                id="reminder-days"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={days}
                aria-invalid={errors.days ? true : undefined}
                aria-describedby={errors.days ? 'reminder-days-error' : undefined}
                onChange={(e) => {
                  setDays(e.target.value)
                  setErrors((x) => ({ ...x, days: undefined }))
                }}
                onBlur={commitDays}
                onKeyDown={onEnter(commitDays)}
                className={controlClass}
              />
            </Cell>
          </div>
        </Group>

        <Group>
          <Toggle
            label="Few entries left"
            hint="Not for memberships with entries per month"
            checked={settings.lowRemindersEnabled}
            onChange={(lowRemindersEnabled) => save({ lowRemindersEnabled })}
          />
          <div className="mt-2">
            <Cell
              label="Remind me at this many entries or fewer"
              htmlFor="reminder-low"
              error={errors.low}
              errorId="reminder-low-error"
              className=""
            >
              <input
                id="reminder-low"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={low}
                aria-invalid={errors.low ? true : undefined}
                aria-describedby={errors.low ? 'reminder-low-error' : undefined}
                onChange={(e) => {
                  setLow(e.target.value)
                  setErrors((x) => ({ ...x, low: undefined }))
                }}
                onBlur={commitLow}
                onKeyDown={onEnter(commitLow)}
                className={controlClass}
              />
            </Cell>
          </div>
        </Group>

        <Group>
          <Toggle
            label="Monthly entries about to reset"
            hint="For memberships with entries per month. Shown when entries are left and the reset is within the shortest number of days above."
            checked={settings.resetRemindersEnabled}
            onChange={(resetRemindersEnabled) => save({ resetRemindersEnabled })}
          />
        </Group>
      </div>
    </section>
  )
}
