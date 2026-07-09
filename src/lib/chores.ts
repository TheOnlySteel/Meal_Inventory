import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Chore } from './types'
import { fmtDate } from './format'

/**
 * Next due date after completing a recurring chore.
 * MUST mirror complete_chore's SQL exactly (max(today, due ?? today) + interval)
 * so optimistic updates don't flicker when the server result lands.
 */
export function computeNextDue(chore: Chore, todayIso: string): string {
  const base =
    chore.due_date && chore.due_date > todayIso ? parseISO(chore.due_date) : parseISO(todayIso)
  return format(addDays(base, chore.recur_interval_days ?? 0), 'yyyy-MM-dd')
}

export function dueLabel(dueDate: string | null, todayIso: string): string {
  if (!dueDate) return 'Someday'
  const diff = differenceInCalendarDays(parseISO(dueDate), parseISO(todayIso))
  if (diff < 0) return `${-diff}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff <= 6) return format(parseISO(dueDate), 'EEEE')
  return fmtDate(dueDate)
}

export function recurrenceLabel(days: number | null): string | null {
  if (days == null) return null
  if (days === 1) return 'daily'
  if (days === 7) return 'weekly'
  if (days === 14) return 'every 2 weeks'
  if (days === 30) return 'monthly'
  return `every ${days}d`
}

export interface ChoreGroups {
  overdue: Chore[]
  today: Chore[]
  upcoming: Chore[]
  someday: Chore[]
  done: Chore[]
}

/** Completed one-offs go to done (newest first); recurring chores never do. */
export function groupChores(chores: Chore[], todayIso: string): ChoreGroups {
  const groups: ChoreGroups = { overdue: [], today: [], upcoming: [], someday: [], done: [] }
  for (const c of chores) {
    if (c.completed_at != null) {
      groups.done.push(c)
    } else if (c.due_date == null) {
      groups.someday.push(c)
    } else if (c.due_date < todayIso) {
      groups.overdue.push(c)
    } else if (c.due_date === todayIso) {
      groups.today.push(c)
    } else {
      groups.upcoming.push(c)
    }
  }
  groups.done.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  return groups
}
