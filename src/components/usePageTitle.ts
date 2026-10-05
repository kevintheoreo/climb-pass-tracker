import { useEffect } from 'react'

const APP_NAME = 'Climb Pass Tracker'

/** Sets the browser/tab title for a screen: "About · Climb Pass Tracker". */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
