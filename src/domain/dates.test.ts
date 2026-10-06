import {
  addDays,
  addMonthsToDate,
  dateToNumber,
  daysBetween,
  formatMonthYear,
  formatWeekdayDayMonth,
  localDateOfTimestamp,
  moveTimestampToDate,
  todayLocal,
  toLocalDate,
} from './dates'

describe('daysBetween', () => {
  it('is 0 for the same day, positive forwards and negative backwards', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0)
    expect(daysBetween('2026-10-01', '2026-10-15')).toBe(14)
    expect(daysBetween('2026-10-15', '2026-10-01')).toBe(-14)
  })

  it('counts across month, year and leap-day boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2) // 2028 is a leap year
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1)
  })

  it('is not skewed by daylight saving changes', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetween('2026-10-01', '2026-11-15')).toBe(45)
  })
})

describe('addDays', () => {
  it('adds and subtracts days across boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-01', 0)).toBe('2026-10-01')
  })
})

describe('addMonthsToDate', () => {
  it('adds 6 and 12 months', () => {
    expect(addMonthsToDate('2026-10-01', 6)).toBe('2027-04-01')
    expect(addMonthsToDate('2026-10-01', 12)).toBe('2027-10-01')
  })

  it('clamps to the end of a shorter month', () => {
    expect(addMonthsToDate('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonthsToDate('2027-08-31', 6)).toBe('2028-02-29')
  })
})

describe('local dates', () => {
  it('formats a local Date without shifting the day', () => {
    expect(toLocalDate(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01')
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })

  it('finds the local date of a timestamp', () => {
    const late = new Date(2026, 9, 1, 23, 30).toISOString()
    expect(localDateOfTimestamp(late)).toBe('2026-10-01')
  })
})

describe('dateToNumber', () => {
  it('turns a date into a number that sorts like the date', () => {
    expect(dateToNumber('2026-11-15')).toBe(20261115)
    expect(dateToNumber('2026-11-15')).toBeLessThan(dateToNumber('2027-01-02'))
  })
})

describe('moveTimestampToDate', () => {
  it('puts the same local time of day on another local date', () => {
    const before = new Date(2026, 9, 10, 18, 45, 12, 345)
    const moved = new Date(moveTimestampToDate(before.toISOString(), '2026-09-28'))
    expect(localDateOfTimestamp(moved.toISOString())).toBe('2026-09-28')
    expect([
      moved.getHours(),
      moved.getMinutes(),
      moved.getSeconds(),
      moved.getMilliseconds(),
    ]).toEqual([18, 45, 12, 345])
  })

  it('returns a full ISO timestamp, as a use needs', () => {
    expect(moveTimestampToDate('2026-10-10T04:00:00.000Z', '2026-10-01')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
  })

  it('handles a move across a month or year end', () => {
    const t = new Date(2026, 0, 31, 23, 30).toISOString()
    expect(localDateOfTimestamp(moveTimestampToDate(t, '2025-12-31'))).toBe('2025-12-31')
    expect(localDateOfTimestamp(moveTimestampToDate(t, '2026-02-28'))).toBe('2026-02-28')
  })
})

describe('the usage history wording', () => {
  it('writes a line as weekday, day and month, and a heading as month and year', () => {
    expect(formatWeekdayDayMonth('2026-10-06')).toBe('Tue 6 Oct')
    expect(formatWeekdayDayMonth('2027-01-01')).toBe('Fri 1 Jan')
    expect(formatMonthYear('2026-10-06')).toBe('October 2026')
    expect(formatMonthYear('2027-01-31')).toBe('January 2027')
  })
})
