import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Meal, StorageLocation } from './types'

export type FreshnessKey = 'expired' | 'now' | 'soon' | 'fresh'

export interface Freshness {
  key: FreshnessKey
  label: string
  daysLeft: number
  /** CSS color variable for fills, rings and bars */
  color: string
  /** CSS color variable safe to use as text (amber is darkened on light) */
  textColor: string
  /** 0..1 of shelf life remaining, clamped */
  fraction: number
}

const COLORS: Record<FreshnessKey, string> = {
  expired: 'var(--red)',
  now: 'var(--orange)',
  soon: 'var(--amber)',
  fresh: 'var(--green)',
}

const TEXT_COLORS: Record<FreshnessKey, string> = {
  expired: 'var(--red)',
  now: 'var(--orange)',
  soon: 'var(--amber-text)',
  fresh: 'var(--green)',
}

/**
 * Days-left cutoffs for "eat now" / "eat soon", per storage location.
 * A freezer meal three weeks from expiry is worth planning around; a fridge
 * meal needs the nudge a day out.
 */
const THRESHOLDS: Record<StorageLocation, { now: number; soon: number }> = {
  freezer: { now: 7, soon: 21 },
  fridge: { now: 1, soon: 3 },
  shelf: { now: 2, soon: 5 },
}

export function freshnessOf(
  meal: Pick<Meal, 'best_before' | 'prep_date' | 'storage_location'>,
  today = new Date(),
): Freshness {
  const daysLeft = differenceInCalendarDays(parseISO(meal.best_before), today)
  const total = Math.max(differenceInCalendarDays(parseISO(meal.best_before), parseISO(meal.prep_date)), 1)
  const fraction = Math.min(Math.max(daysLeft / total, 0), 1)
  const t = THRESHOLDS[meal.storage_location] ?? THRESHOLDS.freezer

  let key: FreshnessKey
  if (daysLeft < 0) key = 'expired'
  else if (daysLeft <= t.now) key = 'now'
  else if (daysLeft <= t.soon) key = 'soon'
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

  return { key, label, daysLeft, color: COLORS[key], textColor: TEXT_COLORS[key], fraction }
}

export function urgencySort(a: Meal, b: Meal): number {
  return a.best_before.localeCompare(b.best_before) || a.name.localeCompare(b.name)
}
