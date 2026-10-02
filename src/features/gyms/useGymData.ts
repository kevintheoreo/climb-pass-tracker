import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { BUILTIN_GYMS } from '../../data/gyms'
import { repo } from '../../db'
import { todayLocal } from '../../domain/dates'
import { buildGymList, countActivePassesByGym, type GymEntry } from '../../domain/gyms'

export interface GymData {
  /** Gyms to show in lists: hidden built-in gyms are left out unless the user holds passes there. */
  gyms: GymEntry[]
  /** Every gym including hidden ones, for looking a gym up by reference. */
  allGyms: GymEntry[]
  /** Active pass count per gym id. */
  counts: Record<string, number>
}

/** All gym data for the screens, kept live as the database changes. Undefined while loading. */
export function useGymData(): GymData | undefined {
  const userGyms = useLiveQuery(() => repo.listUserGyms(), [])
  const userTemplates = useLiveQuery(() => repo.listUserTemplates(), [])
  const hiddenGymIds = useLiveQuery(() => repo.listHiddenGymIds(), [])
  const bundles = useLiveQuery(() => repo.listBundles(), [])
  const settings = useLiveQuery(() => repo.getSettings(), [])

  return useMemo(() => {
    if (!userGyms || !userTemplates || !hiddenGymIds || !bundles || !settings) return undefined
    const counts = countActivePassesByGym(bundles, todayLocal(), settings)
    const sources = { builtin: BUILTIN_GYMS, userGyms, userTemplates, hiddenGymIds }
    return {
      gyms: buildGymList(sources, { keepVisibleIds: Object.keys(counts) }),
      allGyms: buildGymList(sources, { includeHidden: true }),
      counts,
    }
  }, [userGyms, userTemplates, hiddenGymIds, bundles, settings])
}
