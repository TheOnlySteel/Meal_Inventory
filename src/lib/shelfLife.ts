import type { StorageLocation } from './types'

/** Freezer shelf life reads naturally in weeks; fridge/shelf in days. */
export const usesWeeks = (loc: StorageLocation) => loc === 'freezer'

/** Sensible default shelf life per location, in the location's display unit. */
export const DEFAULT_LIFE: Record<StorageLocation, string> = {
  freezer: '12',
  fridge: '4',
  shelf: '7',
}

export function lifeFromDays(days: number, loc: StorageLocation): string {
  if (!usesWeeks(loc)) return String(days)
  const weeks = days / 7
  return Number.isInteger(weeks) ? String(weeks) : weeks.toFixed(1)
}

export function daysFromLife(life: string, loc: StorageLocation): number {
  const n = parseFloat(life)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(Math.round(usesWeeks(loc) ? n * 7 : n), 1)
}
