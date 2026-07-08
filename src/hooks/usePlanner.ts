import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { EatPackResult, PlanEntry, PlanEntryInsert } from '../lib/types'
import { useHousehold } from './useHousehold'

const PLAN_KEY = ['plan']
export const planKey = (hid: string | null) => [...PLAN_KEY, hid]

/** The planner strip covers yesterday → 13 days out. */
export function planRange(today = new Date()) {
  return { start: subDays(today, 1), end: addDays(today, 13) }
}

export function usePlan() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: planKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<PlanEntry[]> => {
      const { start, end } = planRange()
      const { data, error } = await supabase
        .from('plan_entries')
        .select('*, meals(*)')
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
  const key = planKey(household?.id ?? null)
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: PLAN_KEY })
    qc.invalidateQueries({ queryKey: ['meals'] })
    qc.invalidateQueries({ queryKey: ['meal_log'] })
  }
  const patchEntry = (id: string, patch: Partial<PlanEntry>) =>
    qc.setQueryData<PlanEntry[]>(key, (old) =>
      old?.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    )

  const addEntry = useMutation({
    mutationFn: async (entry: PlanEntryInsert) => {
      const { error } = await supabase.from('plan_entries').insert(entry)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_entries').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) =>
      qc.setQueryData<PlanEntry[]>(key, (old) => old?.filter((e) => e.id !== id)),
    onSettled: invalidate,
  })

  /** Complete an entry; linked entries also eat one pack atomically. */
  const completeEntry = useMutation({
    mutationFn: async (entry: PlanEntry): Promise<Partial<EatPackResult> & { entry_id: string }> => {
      const { data, error } = await supabase.rpc('complete_plan_entry', { p_entry_id: entry.id })
      if (error) throw error
      return data as Partial<EatPackResult> & { entry_id: string }
    },
    onMutate: async (entry) => patchEntry(entry.id, { completed_at: new Date().toISOString() }),
    onSettled: invalidate,
  })

  const uncompleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.rpc('uncomplete_plan_entry', { p_entry_id: entryId })
      if (error) throw error
    },
    onMutate: async (entryId) => patchEntry(entryId, { completed_at: null, log_id: null }),
    onSettled: invalidate,
  })

  return { addEntry, deleteEntry, completeEntry, uncompleteEntry }
}
