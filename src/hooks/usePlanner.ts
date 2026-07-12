import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { EatPackResult, PlanEntry, PlanEntryInsert, PlanEntryPatch } from '../lib/types'
import { useHousehold } from './useHousehold'
import { useToday } from './useToday'

const PLAN_KEY = ['plan']
export const planKey = (hid: string | null) => [...PLAN_KEY, hid]

/** The home planner covers a week of history through two weeks ahead. */
export function planRange(todayIso: string) {
  const today = parseISO(todayIso)
  return { start: subDays(today, 7), end: addDays(today, 14) }
}

export function usePlan() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  const todayIso = useToday()
  return useQuery({
    // todayIso in the key rolls the fetch window at midnight on long-lived sessions
    queryKey: [...planKey(hid), todayIso],
    enabled: !!hid,
    queryFn: async (): Promise<PlanEntry[]> => {
      const { start, end } = planRange(todayIso)
      const { data, error } = await supabase
        .from('plan_entries')
        .select('*, meals(*)')
        .eq('household_id', hid!)
        .gte('plan_date', format(start, 'yyyy-MM-dd'))
        .lte('plan_date', format(end, 'yyyy-MM-dd'))
        .order('plan_date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as PlanEntry[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function usePlanMutations() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const hid = household?.id ?? null
  const todayIso = useToday()
  const key = [...planKey(hid), todayIso]
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: PLAN_KEY })
    qc.invalidateQueries({ queryKey: ['meals'] })
    qc.invalidateQueries({ queryKey: ['meal_log'] })
  }
  const patchEntry = (id: string, patch: Partial<PlanEntry>) =>
    qc.setQueryData<PlanEntry[]>(key, (old) =>
      old?.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    )
  // Cancel in-flight refetches so a stale response can't clobber the
  // optimistic patch, and snapshot for rollback on error.
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: key })
    return { previous: qc.getQueryData<PlanEntry[]>(key) }
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: PlanEntry[] }) => {
    if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous)
  }

  const addEntry = useMutation({
    mutationFn: async (entry: PlanEntryInsert) => {
      if (!hid) throw new Error('No household')
      const { error } = await supabase.from('plan_entries').insert({ ...entry, household_id: hid })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  /** Batch insert for cook-once-eat-many planning. */
  const addEntries = useMutation({
    mutationFn: async (entries: PlanEntryInsert[]) => {
      if (!hid) throw new Error('No household')
      const rows = entries.map((e) => ({ ...e, household_id: hid }))
      const { error } = await supabase.from('plan_entries').insert(rows)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PlanEntryPatch }) => {
      const { error } = await supabase.from('plan_entries').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => {
      const ctx = await snapshot()
      patchEntry(id, patch)
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_entries').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const ctx = await snapshot()
      qc.setQueryData<PlanEntry[]>(key, (old) => old?.filter((e) => e.id !== id))
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Complete an entry; linked entries also eat one pack atomically. */
  const completeEntry = useMutation({
    mutationFn: async (entry: PlanEntry): Promise<Partial<EatPackResult> & { entry_id: string }> => {
      const { data, error } = await supabase.rpc('complete_plan_entry', { p_entry_id: entry.id })
      if (error) throw error
      return data as Partial<EatPackResult> & { entry_id: string }
    },
    onMutate: async (entry) => {
      const ctx = await snapshot()
      patchEntry(entry.id, { completed_at: new Date().toISOString() })
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const uncompleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.rpc('uncomplete_plan_entry', { p_entry_id: entryId })
      if (error) throw error
    },
    onMutate: async (entryId) => {
      const ctx = await snapshot()
      patchEntry(entryId, { completed_at: null, log_id: null })
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  return { addEntry, addEntries, updateEntry, deleteEntry, completeEntry, uncompleteEntry }
}
