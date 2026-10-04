import { daysBetween, type LocalDate } from './dates'

/** What is wrong with a freeze's two dates, by box. Empty when both are fine. */
export interface FreezeErrors {
  start?: string
  end?: string
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date written `YYYY-MM-DD` (not 2026-02-31). */
function isRealDate(text: string): boolean {
  if (!DATE.test(text)) return false
  const d = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text
}

/** Checks the start and end of a freeze (FR-20); both are reported at once. */
export function checkFreezeDates(start: string, end: string): FreezeErrors {
  const errors: FreezeErrors = {}
  if (!isRealDate(start)) errors.start = 'Enter a start date'
  if (!isRealDate(end)) errors.end = 'Enter an end date'
  if (!errors.start && !errors.end && end < start) {
    errors.end = 'End date cannot be before the start date'
  }
  return errors
}

/** How long a freeze is, counting both its first and last day: one day is "1 day". */
export function freezeDays(start: LocalDate, end: LocalDate): number {
  return daysBetween(start, end) + 1
}
