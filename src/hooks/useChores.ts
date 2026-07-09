import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Chore, ChoreInsert } from '../lib/types'
import { computeNextDue } from '../lib/chores'
import { todayISO } from '../lib/format'
import { useHousehold } from './useHousehold'

const CHORES_KEY = ['chores']
export const choresKey = (hid: string | null) => [...CHORES_KEY, hid]

export function useChores() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: choresKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<Chore[]> => {
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Chore[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useChoreMutations() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const key = choresKey(household?.id ?? null)
  const invalidate = () => qc.invalidateQueries({ queryKey: CHORES_KEY })
  const patch = (id: string, p: Partial<Chore>) =>
    qc.setQueryData<Chore[]>(key, (old) => old?.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const addChore = useMutation({
    mutationFn: async (chore: ChoreInsert) => {
      const { error } = await supabase.from('chores').insert(chore)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const updateChore = useMutation({
    mutationFn: async ({ id, patch: p }: { id: string; patch: Partial<Chore> }) => {
      const { error } = await supabase.from('chores').update(p).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch: p }) => patch(id, p),
    onSettled: invalidate,
  })

  const deleteChore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chores').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) =>
      qc.setQueryData<Chore[]>(key, (old) => old?.filter((c) => c.id !== id)),
    onSettled: invalidate,
  })

  /** Complete: one-offs check off; recurring advance to the next due date. */
  const completeChore = useMutation({
    mutationFn: async (chore: Chore) => {
      const { data, error } = await supabase.rpc('complete_chore', {
        p_chore_id: chore.id,
        p_today: todayISO(),
      })
      if (error) throw error
      return data as { chore_id: string; recurring?: boolean; next_due?: string }
    },
    onMutate: async (chore) => {
      const now = new Date().toISOString()
      if (chore.recur_interval_days == null) {
        patch(chore.id, { completed_at: now, last_completed_at: now })
      } else {
        patch(chore.id, {
          last_completed_at: now,
          prev_due_date: chore.due_date,
          prev_last_completed_at: chore.last_completed_at,
          due_date: computeNextDue(chore, todayISO()),
        })
      }
    },
    onSettled: invalidate,
  })

  const uncompleteChore = useMutation({
    mutationFn: async (choreId: string) => {
      const { error } = await supabase.rpc('uncomplete_chore', { p_chore_id: choreId })
      if (error) throw error
    },
    onMutate: async (choreId) => {
      const chore = qc.getQueryData<Chore[]>(key)?.find((c) => c.id === choreId)
      if (!chore) return
      if (chore.recur_interval_days == null) {
        patch(choreId, { completed_at: null, last_completed_at: chore.prev_last_completed_at })
      } else {
        patch(choreId, {
          due_date: chore.prev_due_date,
          last_completed_at: chore.prev_last_completed_at,
          prev_due_date: null,
          prev_last_completed_at: null,
        })
      }
    },
    onSettled: invalidate,
  })

  return { addChore, updateChore, deleteChore, completeChore, uncompleteChore }
}
