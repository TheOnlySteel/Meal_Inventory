import { format, parseISO } from 'date-fns'

export function fmtDate(iso: string): string {
  return format(parseISO(iso), 'MMM d')
}

export function fmtDateFull(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d yyyy')
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—'
  const r = Number(n)
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(digits || 1)
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
