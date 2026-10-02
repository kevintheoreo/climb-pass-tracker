import type { LocalDate } from './dates'
import { PASS_TYPE_LABELS } from './labels'
import { getPassStatus, lastValidDate } from './passStatus'
import { DEFAULT_SETTINGS } from './settings'
import { isCounted, isMembership, isMonthly, type GymRef, type PassBundle } from './types'

type Cell = string | number | null

/**
 * One CSV cell (RFC 4180). Text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return
 * gets a leading apostrophe, so a gym name or a comment typed as a formula can't run when the file
 * is opened in a spreadsheet. Numbers are written as they are.
 */
export function csvCell(value: Cell): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** A CSV file: a byte-order mark (so Excel reads the UTF-8 right), a header, and CRLF line ends. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const dollars = (cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2))

/** What the export needs to know to turn a gym reference into a name. */
type GymName = (ref: GymRef) => string

/**
 * Every live pass, one row each (FR-45). Amounts are SGD; dates are `YYYY-MM-DD`. "Entries left"
 * is worked out for `today` and is empty for an unlimited membership.
 */
export function passesCsv(bundles: PassBundle[], gymName: GymName, today: LocalDate): string {
  const header = [
    'Pass ID',
    'Gym',
    'Type',
    'Purchase date',
    'Expiry date',
    'Entries',
    'Entries per month',
    'Reset day',
    'Entries used before adding',
    'Entries used in the app',
    'Entries left',
    'Price (S$)',
    'Comments',
    'Added',
    'Last changed',
  ]
  const rows = [...bundles]
    .filter(({ pass }) => pass.deletedAt === null)
    .sort(
      (a, b) =>
        byText(a.pass.purchaseDate, b.pass.purchaseDate) ||
        byText(a.pass.createdAt, b.pass.createdAt) ||
        byText(a.pass.id, b.pass.id),
    )
    .map(({ pass, uses, freezes }): Cell[] => {
      const status = getPassStatus(pass, uses, freezes, today, DEFAULT_SETTINGS)
      return [
        pass.id,
        gymName(pass.gymRef),
        PASS_TYPE_LABELS[pass.passType],
        pass.purchaseDate,
        lastValidDate(pass, freezes),
        isCounted(pass) ? pass.totalEntries : null,
        isMonthly(pass) ? pass.monthlyEntries : null,
        isMembership(pass) ? pass.resetDay : null,
        isCounted(pass) ? pass.initialUsed : null,
        uses.filter((u) => u.deletedAt === null).length,
        status.entriesLeft,
        dollars(pass.priceCents),
        pass.comments,
        pass.createdAt,
        pass.updatedAt,
      ]
    })
  return toCsv(header, rows)
}

/** Every recorded use, one row each, oldest first. A use is a timestamp and nothing else (D26). */
export function usesCsv(bundles: PassBundle[], gymName: GymName): string {
  const header = ['Pass ID', 'Gym', 'Type', 'Used at']
  const rows = bundles
    .filter(({ pass }) => pass.deletedAt === null)
    .flatMap(({ pass, uses }) =>
      uses
        .filter((u) => u.deletedAt === null)
        .map((u) => ({
          usedAt: u.usedAt,
          row: [pass.id, gymName(pass.gymRef), PASS_TYPE_LABELS[pass.passType], u.usedAt] as Cell[],
        })),
    )
    .sort((a, b) => byText(a.usedAt, b.usedAt))
    .map((entry) => entry.row)
  return toCsv(header, rows)
}
