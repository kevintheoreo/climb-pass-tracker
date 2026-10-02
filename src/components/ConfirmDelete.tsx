import { useState } from 'react'
import { buttonClass } from './formUtils'

/** A delete button that asks "are you sure?" in place before doing anything. */
export function ConfirmDelete({
  label,
  prompt,
  onConfirm,
}: {
  label: string
  prompt: string
  onConfirm: () => void | Promise<void>
}) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClass('secondary')}>
        {label}
      </button>
    )
  }
  return (
    <div
      role="alertdialog"
      aria-label={label}
      className="rounded-lg border border-red-300 p-3 dark:border-red-800"
    >
      <p className="mb-3 text-sm">{prompt}</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => void onConfirm()} className={buttonClass('danger')}>
          Yes, delete
        </button>
        <button type="button" onClick={() => setAsking(false)} className={buttonClass('secondary')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
