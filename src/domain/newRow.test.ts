import { BLANK_DRAFT, isTouched, quickExpiry, validateNewRow, withPassType } from './newRow'
import type { NewRowDraft } from './newRow'

const today = '2026-10-02'
const draft = (overrides: Partial<NewRowDraft> = {}): NewRowDraft => ({
  ...BLANK_DRAFT,
  gym: 'Fitbloc',
  entries: '10',
  expiry: '2027-04-02',
  ...overrides,
})

describe('validateNewRow', () => {
  it('turns a complete multipass into a pass bought today', () => {
    const result = validateNewRow(draft({ gym: '  Fitbloc   Dempsey ' }), today)
    expect(result).toEqual({
      ok: true,
      value: {
        gymText: 'Fitbloc Dempsey',
        pass: {
          passType: 'multipass',
          totalEntries: 10,
          initialUsed: 0,
          purchaseDate: today,
          expiryDate: '2027-04-02',
          priceCents: null,
          comments: null,
        },
      },
    })
  })

  it('reports every problem at once', () => {
    const result = validateNewRow(draft({ gym: '  ', entries: '', expiry: '' }), today)
    expect(result).toEqual({
      ok: false,
      errors: {
        gym: 'Enter a gym name',
        entries: 'Enter the number of entries',
        expiry: 'Enter an expiry date',
      },
    })
  })

  it.each([
    ['abc', 'Enter a whole number'],
    ['2.5', 'Enter a whole number'],
    ['-3', 'Enter a whole number'],
    ['0', 'Entries must be at least 1'],
    ['1001', 'Enter 1000 entries or fewer'],
  ])('rejects entries "%s"', (entries, message) => {
    const result = validateNewRow(draft({ entries }), today)
    expect(result).toEqual({ ok: false, errors: { entries: message } })
  })

  it('reports a bad entries count and a past expiry together', () => {
    const result = validateNewRow(draft({ entries: '0', expiry: '2026-10-01' }), today)
    expect(result).toEqual({
      ok: false,
      errors: {
        entries: 'Entries must be at least 1',
        expiry: 'Expiry date cannot be before today',
      },
    })
  })

  it('accepts an expiry of today (usable through it)', () => {
    expect(validateNewRow(draft({ expiry: today }), today).ok).toBe(true)
  })

  it('treats a class pack like a multipass', () => {
    const result = validateNewRow(draft({ passType: 'class_pack', entries: '4' }), today)
    expect(result.ok && result.value.pass).toMatchObject({
      passType: 'class_pack',
      totalEntries: 4,
    })
  })

  it('a single entry needs no entries and no expiry', () => {
    const result = validateNewRow(
      draft({ passType: 'single_entry', entries: 'junk', expiry: '' }),
      today,
    )
    expect(result.ok && result.value.pass).toMatchObject({
      passType: 'single_entry',
      totalEntries: 1,
      initialUsed: 0,
      expiryDate: null,
    })
  })

  it('a single entry keeps an expiry if one is given', () => {
    const result = validateNewRow(draft({ passType: 'single_entry' }), today)
    expect(result.ok && result.value.pass.expiryDate).toBe('2027-04-02')
  })

  it('an unlimited membership leaves entries blank', () => {
    const result = validateNewRow(draft({ passType: 'membership', entries: '' }), today)
    expect(result.ok && result.value.pass).toMatchObject({
      passType: 'membership',
      monthlyEntries: null,
      resetDay: null,
    })
  })

  it('a membership with entries per month uses them as the monthly allowance', () => {
    const result = validateNewRow(draft({ passType: 'membership', entries: '8' }), today)
    expect(result.ok && result.value.pass).toMatchObject({ monthlyEntries: 8 })
  })

  it('a membership still needs an expiry date', () => {
    const result = validateNewRow(draft({ passType: 'membership', entries: '', expiry: '' }), today)
    expect(result).toEqual({ ok: false, errors: { expiry: 'Enter an expiry date' } })
  })

  it('rejects an over-long gym name', () => {
    const result = validateNewRow(draft({ gym: 'x'.repeat(101) }), today)
    expect(result.ok).toBe(false)
  })
})

describe('isTouched', () => {
  it('is false for the blank row and for a changed type alone', () => {
    expect(isTouched(BLANK_DRAFT)).toBe(false)
    expect(isTouched({ ...BLANK_DRAFT, passType: 'membership' })).toBe(false)
    expect(isTouched({ ...BLANK_DRAFT, gym: '   ' })).toBe(false)
  })
  it('is true once any cell has content', () => {
    expect(isTouched({ ...BLANK_DRAFT, gym: 'F' })).toBe(true)
    expect(isTouched({ ...BLANK_DRAFT, entries: '1' })).toBe(true)
    expect(isTouched({ ...BLANK_DRAFT, expiry: '2027-01-01' })).toBe(true)
  })
})

describe('withPassType', () => {
  it('keeps entries between the counted types', () => {
    expect(withPassType(draft(), 'class_pack').entries).toBe('10')
  })
  it('clears entries when they would change meaning', () => {
    expect(withPassType(draft(), 'membership').entries).toBe('')
    expect(withPassType(draft({ passType: 'membership' }), 'multipass').entries).toBe('')
    expect(withPassType(draft(), 'single_entry').entries).toBe('')
  })
  it('keeps the other cells', () => {
    expect(withPassType(draft(), 'membership')).toMatchObject({
      gym: 'Fitbloc',
      expiry: '2027-04-02',
    })
  })
})

describe('quickExpiry', () => {
  it('counts months from the purchase date', () => {
    expect(quickExpiry('2026-10-02', 6)).toBe('2027-04-02')
    expect(quickExpiry('2026-10-02', 12)).toBe('2027-10-02')
  })
  it('clamps to the end of a shorter month', () => {
    expect(quickExpiry('2026-08-31', 6)).toBe('2027-02-28')
  })
})
