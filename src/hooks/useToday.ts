import { useEffect, useState } from 'react'
import { todayISO } from '../lib/format'

/**
 * Today's ISO date as state. The kiosk runs for days, so anything grouping by
 * "today" must re-derive when the calendar rolls over — this ticks every 30s
 * (and on tab focus) but only triggers a re-render when the date changes.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()))
    const t = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
