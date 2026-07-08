import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Meal } from './types'

export type FreshnessKey = 'expired' | 'now' | 'soon' | 'fresh'

export interface Freshness {
  key: FreshnessKey
  label: string
  daysLeft: number
  /** CSS color variable for this status */
  color: string
  /** 0..1 of shelf life remaining, clamped */
  fraction: number
}

const COLORS: Record<FreshnessKey, string> = {
  expired: 'var(--red)',
  now: 'var(--orange)',
  soon: 'var(--amber)',
  fresh: 'var(--green)',
}

export function freshnessOf(meal: Pick<Meal, 'best_before' | 'prep_date'>, today = new Date()): Freshness {
  const daysLeft = differenceInCalendarDays(parseISO(meal.best_before), today)
  const total = Math.max(differenceInCalendarDays(parseISO(meal.best_before), parseISO(meal.prep_date)), 1)
  const fraction = Math.min(Math.max(daysLeft / total, 0), 1)

  let key: FreshnessKey
  if (daysLeft < 0) key = 'expired'
  else if (daysLeft <= 2) key = 'now'
  else if (daysLeft <= 7) key = 'soon'
  else key = 'fresh'

  const label =
    key === 'expired'
      ? daysLeft === -1
        ? 'Expired yesterday'
        : `Expired ${-daysLeft}d ago`
      : daysLeft === 0
        ? 'Eat today'
        : daysLeft === 1
          ? '1 day left'
          : `${daysLeft} days left`

  return { key, label, daysLeft, color: COLORS[key], fraction }
}

export const FRESHNESS_ORDER: Record<FreshnessKey, number> = { expired: 0, now: 1, soon: 2, fresh: 3 }

export function urgencySort(a: Meal, b: Meal): number {
  return a.best_before.localeCompare(b.best_before) || a.name.localeCompare(b.name)
}
