/** Amounts are SGD only (D18) and stored as whole cents. */

export type ParsedMoney = { ok: true; cents: number | null } | { ok: false }

const MAX_CENTS = 100_000_000 // S$1,000,000

/**
 * Reads what a person types into a price box. Accepts `120`, `120.5`, `120.50`, `S$120`, `$1,200`.
 * Empty means "no price" (`cents: null`). Negative numbers, more than two decimals and anything
 * that isn't a plain amount are rejected.
 */
export function parseSgd(input: string): ParsedMoney {
  const text = input.trim().replace(/^S?\$/i, '').replace(/,/g, '').trim()
  if (text === '') return { ok: true, cents: null }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) return { ok: false }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0)
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return { ok: false }
  return { ok: true, cents }
}

/** `12000` → `S$120.00` */
export function formatSgd(cents: number): string {
  const dollars = (cents / 100).toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `S$${dollars}`
}

/** Cents back into editable text: `12000` → `120`, `12050` → `120.50`. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}
