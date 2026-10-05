import { useEffect, useRef, useState } from 'react'
import type { LocalDate } from '../../domain/dates'
import {
  badgesFor,
  expiryLabel,
  pricePerEntryLabel,
  relativeTime,
  resetLabel,
} from '../../domain/format'
import type { BadgeTone } from '../../domain/format'
import type { Row } from '../../domain/rows'
import type { GymEntry } from '../../domain/gyms'
import type { PassDraft } from '../../domain/passForm'
import { Counter } from './Counter'
import { EditPanel } from './EditPanel'
import { WIDE_COLUMNS } from './fields'
import { motionAllowed, ROW_MOTION_MS } from './useRowMotion'

const muted = 'text-stone-600 dark:text-stone-400'

const toneClass: Record<BadgeTone, string> = {
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  muted: 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200',
}

/**
 * True while a just-added row slides in (D57): from the moment it appears for as long as the slide
 * takes. The class is then taken off, so the row's details panel is never clipped. False when the
 * device asks for reduced motion.
 */
function useSlidingIn(justAdded: boolean): boolean {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setDone(true), ROW_MOTION_MS)
    return () => clearTimeout(timer)
  }, [justAdded])
  return justAdded && !done && motionAllowed()
}

export function PassRow({
  row,
  today,
  gyms,
  open,
  highlighted,
  justAdded,
  onToggle,
  onClose,
  onUsedLast,
  onBuyAgain,
  onSaved,
  motion,
  ghost = false,
}: {
  row: Row
  today: LocalDate
  gyms: GymEntry[]
  open: boolean
  /** A reminder banner is about this row (FR-55). */
  highlighted: boolean
  /** The pass was just added: it slides in and is scrolled into view (D46, D57). */
  justAdded: boolean
  onToggle: () => void
  onClose: () => void
  onUsedLast?: ((row: Row) => void) | undefined
  onBuyAgain: (draft: PassDraft) => void
  onSaved: (row: Row) => void
  /** This row is sliding out of the list (`leaving`) or into it (`entering`), FR-61. */
  motion?: 'leaving' | 'entering' | undefined
  /** A copy kept on screen only while it slides out: not for tapping, reading or focus. */
  ghost?: boolean
}) {
  const { status } = row
  const badges = badgesFor(row.pass, status)
  const reset = resetLabel(status)
  const perEntry = pricePerEntryLabel(row.pass)
  const days = row.status.isActive ? row.status.daysLeft : null
  const panelId = `details-${row.pass.id}`
  const item = useRef<HTMLLIElement>(null)
  const slidingIn = useSlidingIn(justAdded)

  useEffect(() => {
    if (!justAdded) return
    // The new row is on top and the person was at the bottom, so bring it into view.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    item.current?.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [justAdded])

  return (
    <li
      ref={item}
      {...(ghost && { inert: true, 'aria-hidden': true })}
      className={[
        // A container for the row's own width: when text is enlarged the row is narrow in rem, and
        // the cells stack in one column instead of running off the screen (WCAG 1.4.10).
        '@container',
        motion === 'leaving'
          ? 'row-leaving'
          : motion === 'entering' || slidingIn
            ? 'row-entering'
            : '',
        open ? 'bg-stone-50 dark:bg-stone-950' : '',
        // A reminder (low or expiring soon): the redder brand orange, like its banner.
        highlighted
          ? 'bg-brand-100 ring-2 ring-inset ring-brand-500 dark:bg-brand-950/70 dark:ring-brand-400'
          : '',
      ].join(' ')}
    >
      <div className="row-body">
        {/* A tap anywhere on the row that is not a button opens its details (FR-56). The gym name is
            the keyboard and screen-reader way in. */}
        <div
          onClick={(e) => {
            if (
              e.target instanceof Element &&
              e.target.closest('button, a, input, select, textarea')
            )
              return
            onToggle()
          }}
          className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 @max-[19rem]:grid-cols-[minmax(0,1fr)] sm:items-center ${WIDE_COLUMNS}`}
        >
          <p className="col-start-1 row-start-1 min-w-0 break-words font-medium">
            {justAdded && <span className="sr-only">Just added. </span>}
            {highlighted && <span className="sr-only">Has a reminder. </span>}
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

          <div className="col-start-2 row-start-1 flex flex-col items-end @max-[19rem]:col-start-1 @max-[19rem]:row-start-2 @max-[19rem]:items-start sm:col-start-4 sm:items-start">
            <Counter row={row} today={today} onUsedLast={onUsedLast} />
            {reset && <p className={`text-sm ${muted}`}>{reset}</p>}
          </div>

          <p
            className={`col-start-1 row-start-2 text-sm @max-[19rem]:row-start-3 sm:col-start-2 sm:row-start-1 sm:text-base ${muted}`}
          >
            <span className="sr-only">Type: </span>
            {row.typeLabel}
            {perEntry && (
              <span className="block text-sm">
                <span className="sr-only">Price per entry: </span>
                {perEntry}
              </span>
            )}
          </p>

          <p
            className={`col-start-2 row-start-2 text-right text-sm @max-[19rem]:col-start-1 @max-[19rem]:row-start-4 @max-[19rem]:text-left sm:col-start-3 sm:row-start-1 sm:text-left sm:text-base ${muted}`}
          >
            <span className="sr-only">Expiry: </span>
            {expiryLabel(row.expiry)}
            {days !== null && <span className="block text-sm">{relativeTime(days, today)}</span>}
          </p>

          {badges.length > 0 && (
            <ul
              aria-label="Status"
              className="col-span-2 row-start-3 flex flex-wrap gap-1.5 @max-[19rem]:col-span-1 @max-[19rem]:row-start-5 sm:col-span-4 sm:row-start-2"
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
            <EditPanel
              id={panelId}
              row={row}
              gyms={gyms}
              today={today}
              onClose={onClose}
              onBuyAgain={onBuyAgain}
              onSaved={() => onSaved(row)}
            />
          </div>
        )}
      </div>
    </li>
  )
}
