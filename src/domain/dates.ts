import { addMonths, format, parseISO } from 'date-fns'

/** A calendar date as `YYYY-MM-DD`, in the device's local time zone. */
export type LocalDate = string

const DAY_MS = 86_400_000

/** Whole days since the epoch for a `YYYY-MM-DD` date. Uses UTC so daylight saving can't skew it. */
function dayNumber(date: LocalDate): number {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return Date.UTC(year, month - 1, day) / DAY_MS
}

export function toLocalDate(date: Date): LocalDate {
  return format(date, 'yyyy-MM-dd')
}

/** Today's date. `now` is injectable so tests (and callers) control the clock. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now)
}

/** The local calendar date on which an ISO timestamp (e.g. a `Use.usedAt`) falls. */
export function localDateOfTimestamp(timestamp: string): LocalDate {
  return toLocalDate(new Date(timestamp))
}

/**
 * The same time of day as `timestamp` (in the device's time zone), on the local date `date`. Used
 * when the date of a recorded use is edited: the time stays, so uses on one day keep their order.
 */
export function moveTimestampToDate(timestamp: string, date: LocalDate): string {
  const time = new Date(timestamp)
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  ).toISOString()
}

/** Days from `from` to `to`. Positive when `to` is later, 0 when equal, negative when earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayNumber(to) - dayNumber(from)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10)
}

/** Adds calendar months, clamping to the end of a shorter month (31 Aug + 6 months = 28 Feb). */
export function addMonthsToDate(date: LocalDate, months: number): LocalDate {
  return toLocalDate(addMonths(parseISO(date), months))
}

/** `2026-11-15` → `20261115`. Used where a date has to be stored as a plain number. */
export function dateToNumber(date: LocalDate): number {
  return Number(date.replaceAll('-', ''))
}

/** `2026-12-31` → `31 Dec 2026` */
export function formatDate(date: LocalDate): string {
  return format(parseISO(date), 'd MMM yyyy')
}

/** `2026-10-06` → `Tue 6 Oct`: a line of the usage history, under its month's heading. */
export function formatWeekdayDayMonth(date: LocalDate): string {
  return format(parseISO(date), 'EEE d MMM')
}

/** `2026-10-06` → `October 2026`: the heading of a month in the usage history. */
export function formatMonthYear(date: LocalDate): string {
  return format(parseISO(date), 'MMMM yyyy')
}

/** `2026-11-15` → `15 Nov` */
export function formatDayMonth(date: LocalDate): string {
  return format(parseISO(date), 'd MMM')
}
