import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { repo } from '../../db'
import { findGym } from '../../domain/gyms'
import type { LocalDate } from '../../domain/dates'
import { buildRows, type Rows } from '../../domain/rows'
import { useToday } from './useToday'

/** The main screen's rows, kept live as the database changes. Undefined while loading. */
export function usePassRows(): (Rows & { today: LocalDate }) | undefined {
  const today = useToday()
  const bundles = useLiveQuery(() => repo.listBundles(), [])
  const gyms = useLiveQuery(() => repo.listGyms(), [])
  const settings = useLiveQuery(() => repo.getSettings(), [])

  return useMemo(() => {
    if (!bundles || !gyms || !settings) return undefined
    const rows = buildRows(
      bundles,
      (ref) => findGym(gyms, ref)?.name ?? 'Unknown gym',
      today,
      settings,
    )
    return { ...rows, today }
  }, [bundles, gyms, settings, today])
}
