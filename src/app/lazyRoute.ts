import { lazy, type ComponentType } from 'react'

const RELOADED = 'reloaded-for-update'

/**
 * `React.lazy` for a screen that is downloaded when it is first opened. After a release the old files
 * are gone from the site, so a tab that was already open and then opens one of these asks for a file
 * that no longer exists. The page reloads itself once to pick up the new version; if the file is still
 * missing after that (really offline, say) the error shows as usual instead of looping.
 */
export function lazyRoute(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const module = await load()
      try {
        sessionStorage.removeItem(RELOADED)
      } catch {
        // No session storage: nothing to forget.
      }
      return module
    } catch (error) {
      try {
        if (!sessionStorage.getItem(RELOADED)) {
          sessionStorage.setItem(RELOADED, '1')
          window.location.reload()
          return await new Promise<never>(() => {}) // the page is going away: show nothing meanwhile
        }
      } catch {
        // No session storage: fall through to the error.
      }
      throw error
    }
  })
}
