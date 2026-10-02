import { useEffect, useState } from 'react'
import type { LocalDate } from '../../domain/dates'
import { todayLocal } from '../../domain/dates'

/**
 * Today's date, kept up to date for an app left open overnight: it re-checks every minute and
 * whenever the page comes back into view, so passes expire and monthly counts reset on time.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => todayLocal())

  useEffect(() => {
    const check = () =>
      setToday((previous) => {
        const now = todayLocal()
        return now === previous ? previous : now
      })
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
