import { parseLowThreshold, parseReminderDays } from './settings'

describe('parseReminderDays', () => {
  it('reads days separated by commas or spaces, biggest first, without repeats', () => {
    expect(parseReminderDays('14, 3')).toEqual({ ok: true, value: [14, 3] })
    expect(parseReminderDays('3 14')).toEqual({ ok: true, value: [14, 3] })
    expect(parseReminderDays('7,7, 7')).toEqual({ ok: true, value: [7] })
    expect(parseReminderDays(' 30;7 ')).toEqual({ ok: true, value: [30, 7] })
  })
  it.each(['', '  ', 'x', '0', '366', '1.5', '-3', '14, x', '1 2 3 4 5 6'])(
    'rejects %j',
    (text) => {
      expect(parseReminderDays(text).ok).toBe(false)
    },
  )
  it('accepts exactly five and the limits 1 and 365', () => {
    expect(parseReminderDays('365 100 30 7 1')).toEqual({ ok: true, value: [365, 100, 30, 7, 1] })
  })
  it('says what is expected', () => {
    expect(parseReminderDays('x')).toEqual({
      ok: false,
      error: 'Enter up to 5 numbers of days from 1 to 365, like 14, 3',
    })
  })
})

describe('parseLowThreshold', () => {
  it('accepts whole numbers from 1 to 100', () => {
    expect(parseLowThreshold('2')).toEqual({ ok: true, value: 2 })
    expect(parseLowThreshold(' 100 ')).toEqual({ ok: true, value: 100 })
    expect(parseLowThreshold('1')).toEqual({ ok: true, value: 1 })
  })
  it.each(['', '0', '101', '1.5', '-1', 'two'])('rejects %j', (text) => {
    expect(parseLowThreshold(text)).toEqual({ ok: false, error: 'Enter a number from 1 to 100' })
  })
})
