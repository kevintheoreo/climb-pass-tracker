import { centsToInput, formatSgd, parseSgd } from './money'

describe('parseSgd', () => {
  it('reads plain amounts into cents', () => {
    expect(parseSgd('120')).toEqual({ ok: true, cents: 12000 })
    expect(parseSgd('120.5')).toEqual({ ok: true, cents: 12050 })
    expect(parseSgd('120.50')).toEqual({ ok: true, cents: 12050 })
    expect(parseSgd('0.07')).toEqual({ ok: true, cents: 7 })
    expect(parseSgd('0')).toEqual({ ok: true, cents: 0 })
  })

  it('does not suffer floating-point errors', () => {
    expect(parseSgd('19.99')).toEqual({ ok: true, cents: 1999 })
    expect(parseSgd('1.15')).toEqual({ ok: true, cents: 115 })
    expect(parseSgd('4.35')).toEqual({ ok: true, cents: 435 })
  })

  it('accepts a currency sign, thousands separators and surrounding spaces', () => {
    expect(parseSgd('S$120')).toEqual({ ok: true, cents: 12000 })
    expect(parseSgd(' $1,200.00 ')).toEqual({ ok: true, cents: 120000 })
  })

  it('treats empty input as "no price"', () => {
    expect(parseSgd('')).toEqual({ ok: true, cents: null })
    expect(parseSgd('   ')).toEqual({ ok: true, cents: null })
  })

  it('rejects negatives, extra decimals, text and absurd amounts', () => {
    for (const bad of [
      '-5',
      '1.234',
      'abc',
      '12 dollars',
      '1.',
      '.5',
      '1e3',
      '1,2,3x',
      '9999999999',
    ]) {
      expect(parseSgd(bad)).toEqual({ ok: false })
    }
  })
})

describe('formatSgd / centsToInput', () => {
  it('formats with S$, two decimals and thousands separators', () => {
    expect(formatSgd(12000)).toBe('S$120.00')
    expect(formatSgd(5)).toBe('S$0.05')
    expect(formatSgd(123456)).toBe('S$1,234.56')
  })

  it('turns cents back into editable text that parses to the same value', () => {
    expect(centsToInput(null)).toBe('')
    expect(centsToInput(12000)).toBe('120')
    expect(centsToInput(12050)).toBe('120.50')
    for (const cents of [0, 7, 99, 12000, 12050, 123456]) {
      expect(parseSgd(centsToInput(cents))).toEqual({ ok: true, cents })
    }
  })
})
