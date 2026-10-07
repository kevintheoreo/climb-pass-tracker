import { useEffect } from 'react'
import type { LocalDate } from '../../domain/dates'
import { dropboxAppKey } from './dropboxApi'

/**
 * Starts the daily Dropbox backup when the main screen opens, and again when the app comes back
 * into view on a later day. It does nothing, and loads nothing, while the feature is off or nobody
 * has connected Dropbox.
 */
export function useDropboxAutoBackup(today: LocalDate | null): void {
  useEffect(() => {
    if (!dropboxAppKey() || today === null) return
    const run = () => {
      if (document.visibilityState === 'hidden') return
      void import('./dropboxBackup').then((m) => m.runAutoBackup(today))
    }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [today])
}
