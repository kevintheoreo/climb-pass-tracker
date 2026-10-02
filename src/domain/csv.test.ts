import { csvCell, passesCsv, toCsv, usesCsv } from './csv'
import {
  at,
  bundle,
  makeCounted,
  makeFreeze,
  makeMembership,
  makeMonthly,
  makeSingle,
  makeUse,
} from './testFactories'

const today = '2026-06-15'
const gymName = () => 'Fitbloc'
const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n')

describe('csvCell', () => {
  it('leaves plain text and numbers alone, and writes nothing for null', () => {
    expect(csvCell('Fitbloc')).toBe('Fitbloc')
    expect(csvCell(12)).toBe('12')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(null)).toBe('')
  })
  it('quotes text with commas, quotes or line breaks, doubling the quotes', () => {
    expect(csvCell('Bishan, Junction 8')).toBe('"Bishan, Junction 8"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })
  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx'])(
    'defuses text a spreadsheet would run as a formula: %j',
    (text) => {
      expect(csvCell(text).replaceAll('"', '').startsWith("'")).toBe(true)
    },
  )
  it('does not touch a number that is negative', () => {
    expect(csvCell(-5)).toBe('-5')
  })
})

describe('toCsv', () => {
  it('starts with a byte-order mark, uses CRLF and ends with a line break', () => {
    const csv = toCsv(['a', 'b'], [['1', 2]])
    expect(csv).toBe('﻿a,b\r\n1,2\r\n')
  })
  it('a header alone is still a valid file', () => {
    expect(toCsv(['a'], [])).toBe('﻿a\r\n')
  })
})

describe('passesCsv', () => {
  it('writes one row per pass with every field', () => {
    const pass = makeCounted({
      id: 'p1',
      purchaseDate: '2026-01-10',
      expiryDate: '2026-12-31',
      totalEntries: 10,
      initialUsed: 2,
      priceCents: 12050,
      comments: 'sale, 2 for 1',
    })
    const csv = passesCsv([bundle(pass, { uses: [makeUse('p1'), makeUse('p1')] })], gymName, today)
    const [header, row] = lines(csv)
    expect(header).toBe(
      'Pass ID,Gym,Type,Purchase date,Expiry date,Entries,Entries per month,Reset day,Entries used before adding,Entries used in the app,Entries left,Price (S$),Comments,Added,Last changed',
    )
    expect(row).toBe(
      'p1,Fitbloc,Multipass,2026-01-10,2026-12-31,10,,,2,2,6,120.50,"sale, 2 for 1",2026-01-01T00:00:00.000Z,2026-01-01T00:00:00.000Z',
    )
  })

  it('a single entry has one entry and may have no expiry or price', () => {
    const csv = passesCsv([bundle(makeSingle({ id: 's1', expiryDate: null }))], gymName, today)
    expect(lines(csv)[1]).toMatch(/^s1,Fitbloc,Single entry,2026-01-01,,1,,,0,0,1,,,/)
  })

  it('an unlimited membership has no entries and nothing left', () => {
    const csv = passesCsv([bundle(makeMembership({ id: 'm1' }))], gymName, today)
    const cells = lines(csv)[1]!.split(',')
    expect(cells[2]).toBe('Membership')
    expect(cells.slice(5, 11)).toEqual(['', '', '', '', '0', ''])
  })

  it('a monthly membership shows its allowance, reset day and this month’s count', () => {
    const pass = makeMonthly({
      id: 'm2',
      purchaseDate: '2026-06-01',
      monthlyEntries: 8,
      resetDay: 20,
    })
    const uses = [
      makeUse('m2', { usedAt: at('2026-05-25') }),
      makeUse('m2', { usedAt: at('2026-06-02') }),
    ]
    const cells = lines(passesCsv([bundle(pass, { uses })], gymName, '2026-06-15'))[1]!.split(',')
    expect(cells.slice(5, 11)).toEqual(['', '8', '20', '', '2', '7'])
  })

  it('the expiry of a membership includes its freezes', () => {
    const pass = makeMembership({ id: 'm3', purchaseDate: '2026-01-01', expiryDate: '2026-12-31' })
    const csv = passesCsv(
      [bundle(pass, { freezes: [makeFreeze('m3', '2026-03-01', '2026-03-10')] })],
      gymName,
      today,
    )
    expect(lines(csv)[1]!.split(',')[4]).toBe('2027-01-10')
  })

  it('leaves out deleted passes and deleted uses, and sorts by purchase date', () => {
    const early = makeCounted({ id: 'a', purchaseDate: '2026-01-01' })
    const late = makeCounted({ id: 'b', purchaseDate: '2026-03-01' })
    const gone = makeCounted({ id: 'c', deletedAt: '2026-04-01T00:00:00.000Z' })
    const csv = passesCsv(
      [
        bundle(late),
        bundle(gone),
        bundle(early, { uses: [makeUse('a', { deletedAt: '2026-04-01T00:00:00.000Z' })] }),
      ],
      gymName,
      today,
    )
    const rows = lines(csv).slice(1)
    expect(rows.map((r) => r.split(',')[0])).toEqual(['a', 'b'])
    expect(rows[0]!.split(',')[9]).toBe('0')
  })

  it('does not let a typed formula run', () => {
    const csv = passesCsv(
      [bundle(makeCounted({ id: 'x', comments: '=HYPERLINK("http://evil")' }))],
      () => '+cmd',
      today,
    )
    expect(csv).toContain(",'+cmd,")
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })

  it('no passes is a header and nothing else', () => {
    expect(lines(passesCsv([], gymName, today))).toHaveLength(1)
  })
})

describe('usesCsv', () => {
  it('lists every recorded use, oldest first, with the pass it belongs to', () => {
    const a = makeCounted({ id: 'a' })
    const b = makeMonthly({ id: 'b' })
    const csv = usesCsv(
      [
        bundle(a, { uses: [makeUse('a', { usedAt: '2026-06-03T10:00:00.000Z' })] }),
        bundle(b, {
          uses: [
            makeUse('b', { usedAt: '2026-06-01T10:00:00.000Z' }),
            makeUse('b', {
              usedAt: '2026-06-09T10:00:00.000Z',
              deletedAt: '2026-06-10T00:00:00.000Z',
            }),
          ],
        }),
      ],
      gymName,
    )
    expect(lines(csv)).toEqual([
      'Pass ID,Gym,Type,Used at',
      'b,Fitbloc,Membership,2026-06-01T10:00:00.000Z',
      'a,Fitbloc,Multipass,2026-06-03T10:00:00.000Z',
    ])
  })

  it('has no names or notes: a use is a timestamp (D26)', () => {
    expect(lines(usesCsv([], gymName))[0]).toBe('Pass ID,Gym,Type,Used at')
  })

  it('skips the uses of a deleted pass', () => {
    const gone = makeCounted({ id: 'g', deletedAt: '2026-04-01T00:00:00.000Z' })
    expect(lines(usesCsv([bundle(gone, { uses: [makeUse('g')] })], gymName))).toHaveLength(1)
  })
})
