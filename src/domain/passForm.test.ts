import {
  BLANK_DRAFT,
  draftFromPass,
  isChanged,
  mergeDraft,
  isTouched,
  quickExpiry,
  validatePassDraft,
  withPassType,
} from './passForm'
import type { PassDraft } from './passForm'
import { makeCounted, makeMembership, makeMonthly, makeSingle } from './testFactories'

const validateNewRow = (draft: PassDraft, today: string) =>
  validatePassDraft(draft, { today, adding: true })
const validateEdit = (draft: PassDraft, today: string) =>
  validatePassDraft(draft, { today, adding: false })

const today = '2026-10-02'
const draft = (overrides: Partial<PassDraft> = {}): PassDraft => ({
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
        usedThisMonth: null,
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

describe('validatePassDraft when editing', () => {
  const edit = (overrides: Partial<PassDraft> = {}): PassDraft => ({
    ...BLANK_DRAFT,
    gym: 'Fitbloc',
    entries: '10',
    expiry: '2027-04-02',
    purchaseDate: '2026-09-01',
    ...overrides,
  })

  it('keeps the purchase date, price, already-used and comments', () => {
    const result = validateEdit(
      edit({ price: 'S$1,200.50', usedBefore: '3', comments: ' bought at a sale ' }),
      today,
    )
    expect(result.ok && result.value.pass).toMatchObject({
      purchaseDate: '2026-09-01',
      priceCents: 120050,
      initialUsed: 3,
      comments: ' bought at a sale ',
    })
  })

  it('an empty price, already-used and comments mean none, none and null', () => {
    const result = validateEdit(edit(), today)
    expect(result.ok && result.value.pass).toMatchObject({
      priceCents: null,
      initialUsed: 0,
      comments: null,
    })
  })

  it('an expired pass can still be edited: only the purchase date is the limit for the expiry', () => {
    expect(validateEdit(edit({ expiry: '2026-09-02' }), today).ok).toBe(true)
    expect(validateEdit(edit({ expiry: '2026-08-31' }), today)).toEqual({
      ok: false,
      errors: { expiry: 'Expiry date cannot be before the purchase date' },
    })
  })

  it('reports every problem at once', () => {
    const result = validateEdit(
      edit({
        gym: '',
        entries: '0',
        purchaseDate: '',
        price: 'cheap',
        usedBefore: 'x',
        comments: 'y'.repeat(501),
      }),
      today,
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        gym: 'Enter a gym name',
        entries: 'Entries must be at least 1',
        purchaseDate: 'Enter the purchase date',
        price: 'Enter an amount like 120 or 120.50',
        usedBefore: 'Enter a whole number',
        comments: 'Keep comments under 500 characters',
      },
    })
    const longComment = validateEdit(edit({ comments: 'y'.repeat(501) }), today)
    expect(longComment).toEqual({
      ok: false,
      errors: { comments: 'Keep comments under 500 characters' },
    })
  })

  it('already used cannot be more than the total', () => {
    expect(validateEdit(edit({ usedBefore: '11' }), today)).toEqual({
      ok: false,
      errors: { usedBefore: 'Cannot be more than the total entries' },
    })
    expect(validateEdit(edit({ usedBefore: '10' }), today).ok).toBe(true)
  })

  it('a single entry can be already used once but not twice', () => {
    const single = edit({ passType: 'single_entry', entries: '', expiry: '' })
    expect(validateEdit({ ...single, usedBefore: '1' }, today).ok).toBe(true)
    expect(validateEdit({ ...single, usedBefore: '2' }, today)).toEqual({
      ok: false,
      errors: { usedBefore: 'Cannot be more than the total entries' },
    })
  })

  it('a monthly membership takes a reset day and entries already used this month', () => {
    const monthly = edit({
      passType: 'membership',
      entries: '8',
      resetDay: '15',
      usedThisMonth: '3',
      usedBefore: 'ignored',
    })
    const result = validateEdit(monthly, today)
    expect(result).toMatchObject({
      ok: true,
      value: { usedThisMonth: 3, pass: { monthlyEntries: 8, resetDay: 15 } },
    })
  })

  it('a blank reset day follows the purchase day', () => {
    const result = validateEdit(edit({ passType: 'membership', entries: '8' }), today)
    expect(result.ok && result.value.pass).toMatchObject({ resetDay: null })
    expect(result.ok && result.value.usedThisMonth).toBe(0)
  })

  it.each([
    ['0', 'Enter a day from 1 to 31'],
    ['32', 'Enter a day from 1 to 31'],
    ['x', 'Enter a day from 1 to 31'],
  ])('rejects reset day "%s"', (resetDay, message) => {
    const result = validateEdit(edit({ passType: 'membership', entries: '8', resetDay }), today)
    expect(result).toEqual({ ok: false, errors: { resetDay: message } })
  })

  it('used this month cannot be more than the monthly allowance', () => {
    const result = validateEdit(
      edit({ passType: 'membership', entries: '8', usedThisMonth: '9' }),
      today,
    )
    expect(result).toEqual({
      ok: false,
      errors: { usedThisMonth: 'Cannot be more than the entries per month' },
    })
  })

  it('an unlimited membership ignores the monthly-only boxes', () => {
    const result = validateEdit(
      edit({ passType: 'membership', entries: '', resetDay: '15', usedThisMonth: '4' }),
      today,
    )
    expect(result).toMatchObject({
      ok: true,
      value: { usedThisMonth: null, pass: { monthlyEntries: null, resetDay: null } },
    })
  })
})

describe('draftFromPass', () => {
  it('shows a multipass as typed text', () => {
    const pass = makeCounted({ priceCents: 12050, comments: 'sale', initialUsed: 3 })
    expect(draftFromPass(pass, 'Fitbloc', 0)).toEqual({
      gym: 'Fitbloc',
      passType: 'multipass',
      entries: '10',
      expiry: pass.expiryDate,
      purchaseDate: pass.purchaseDate,
      price: '120.50',
      usedBefore: '3',
      usedThisMonth: '',
      resetDay: '',
      comments: 'sale',
    })
  })

  it('shows a single entry with no entries and maybe no expiry', () => {
    const draft = draftFromPass(makeSingle({ expiryDate: null }), 'Fitbloc', 0)
    expect(draft).toMatchObject({
      passType: 'single_entry',
      entries: '',
      expiry: '',
      usedBefore: '0',
    })
  })

  it('shows an unlimited membership with blank entries', () => {
    const draft = draftFromPass(makeMembership(), 'Fitbloc', 0)
    expect(draft).toMatchObject({ entries: '', usedThisMonth: '', resetDay: '' })
  })

  it('shows a monthly membership with its allowance, reset day and count this month', () => {
    const draft = draftFromPass(makeMonthly({ monthlyEntries: 8, resetDay: 20 }), 'Fitbloc', 5)
    expect(draft).toMatchObject({ entries: '8', resetDay: '20', usedThisMonth: '5' })
  })

  it('round-trips: a draft made from a pass validates and changes nothing', () => {
    for (const pass of [makeCounted(), makeSingle(), makeMembership(), makeMonthly()]) {
      const draft = draftFromPass(pass, 'Fitbloc', 0)
      const result = validateEdit(draft, '2026-06-01')
      expect(result.ok).toBe(true)
      expect(isChanged(draft, draftFromPass(pass, 'Fitbloc', 0))).toBe(false)
    }
  })
})

describe('isChanged', () => {
  it('notices any difference', () => {
    const a = draftFromPass(makeCounted(), 'Fitbloc', 0)
    expect(isChanged({ ...a, comments: 'x' }, a)).toBe(true)
    expect(isChanged({ ...a }, a)).toBe(false)
  })
})

describe('isChanged ignores differences that save to the same thing', () => {
  const a = draftFromPass(makeCounted({ priceCents: 12050 }), 'Fit Bloc', 0)
  it('spacing and the case of the gym name', () => {
    expect(isChanged({ ...a, gym: '  fit   BLOC ' }, a)).toBe(false)
    expect(isChanged({ ...a, gym: 'Fit Bloc 2' }, a)).toBe(true)
  })
  it('the way a price is written', () => {
    expect(isChanged({ ...a, price: 'S$120.5' }, a)).toBe(false)
    expect(isChanged({ ...a, price: '121' }, a)).toBe(true)
    expect(isChanged({ ...a, price: 'cheap' }, a)).toBe(true)
  })
  it('spaces around other boxes', () => {
    expect(isChanged({ ...a, comments: '  ' }, a)).toBe(false)
    expect(isChanged({ ...a, entries: ' 10 ' }, a)).toBe(false)
  })
})

describe('mergeDraft', () => {
  const before = draftFromPass(makeMonthly({ monthlyEntries: 8 }), 'Fit Bloc', 2)
  const after = { ...before, usedThisMonth: '3', comments: 'changed elsewhere' }

  it('untouched boxes follow the saved pass', () => {
    expect(mergeDraft(before, before, after)).toEqual(after)
  })
  it('boxes being edited keep what was typed', () => {
    const typing = { ...before, comments: 'my note', usedThisMonth: '5' }
    expect(mergeDraft(typing, before, after)).toEqual({
      ...after,
      comments: 'my note',
      usedThisMonth: '5',
    })
  })
})
