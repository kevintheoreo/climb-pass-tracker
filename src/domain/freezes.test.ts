import { checkFreezeDates, freezeDays } from './freezes'

describe('checkFreezeDates', () => {
  it('accepts a start and an end, and a one-day freeze', () => {
    expect(checkFreezeDates('2026-10-05', '2026-10-12')).toEqual({})
    expect(checkFreezeDates('2026-10-05', '2026-10-05')).toEqual({})
  })

  it('asks for a missing date, and says so for both at once', () => {
    expect(checkFreezeDates('', '2026-10-12')).toEqual({ start: 'Enter a start date' })
    expect(checkFreezeDates('2026-10-05', '')).toEqual({ end: 'Enter an end date' })
    expect(checkFreezeDates('', '')).toEqual({
      start: 'Enter a start date',
      end: 'Enter an end date',
    })
  })

  it('refuses a date that is not a real day', () => {
    expect(checkFreezeDates('2026-02-31', '2026-03-05')).toEqual({ start: 'Enter a start date' })
    expect(checkFreezeDates('2026-10-05', '10/12/2026')).toEqual({ end: 'Enter an end date' })
  })

  it('refuses an end before the start', () => {
    expect(checkFreezeDates('2026-10-12', '2026-10-05')).toEqual({
      end: 'End date cannot be before the start date',
    })
  })
})

describe('freezeDays', () => {
  it('counts the first and the last day', () => {
    expect(freezeDays('2026-10-05', '2026-10-05')).toBe(1)
    expect(freezeDays('2026-10-05', '2026-10-12')).toBe(8)
    expect(freezeDays('2026-02-27', '2026-03-02')).toBe(4)
  })
})
