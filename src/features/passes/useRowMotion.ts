import { useEffect, useState } from 'react'
import type { Row } from '../../domain/rows'

/** How long a row takes to slide away or in (matches the CSS in `index.css`), plus a little. */
export const ROW_MOTION_MS = 340

/** A row that has just left a list and is shown a moment longer, sliding out. */
export interface Ghost {
  row: Row
  /** Where it was in the list, so it slides out from the same place. */
  index: number
}

/** Is motion welcome? Not when the device's reduced-motion setting is on, or can't be read. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const NONE: ReadonlySet<string> = new Set()

/**
 * Row motion (FR-61) for one of the two lists (the main list or Finished): a row that moved to the
 * other list stays in this one for a moment as a `ghost` that slides out, and a row that came from
 * the other list is `entering`, sliding in. A deleted row, a new row and the first screen of rows
 * move nothing. Ghosts are only for show: the caller makes them inert.
 */
export function useRowMotion(
  list: Row[],
  other: Row[],
): { ghosts: Ghost[]; entering: ReadonlySet<string> } {
  const [seen, setSeen] = useState({ list, other })
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [entering, setEntering] = useState<ReadonlySet<string>>(NONE)

  // Worked out while rendering (not in an effect), so a row never vanishes for a frame first.
  if (seen.list !== list || seen.other !== other) {
    setSeen({ list, other })
    if (motionAllowed()) {
      const ids = (rows: Row[]) => new Set(rows.map((r) => r.pass.id))
      const [now, nowOther] = [ids(list), ids(other)]
      const [before, beforeOther] = [ids(seen.list), ids(seen.other)]
      const left = seen.list
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !now.has(row.pass.id) && nowOther.has(row.pass.id))
      const came = list
        .map((row) => row.pass.id)
        .filter((id) => !before.has(id) && beforeOther.has(id))
      if (left.length > 0) setGhosts((g) => [...g, ...left])
      if (came.length > 0) setEntering((e) => new Set([...e, ...came]))
    }
  }

  useEffect(() => {
    if (ghosts.length === 0 && entering.size === 0) return
    const timer = setTimeout(() => {
      setGhosts([])
      setEntering(NONE)
    }, ROW_MOTION_MS)
    return () => clearTimeout(timer)
  }, [ghosts, entering])

  return { ghosts, entering }
}
