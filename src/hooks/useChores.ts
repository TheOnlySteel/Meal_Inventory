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
        .eq('household_id', hid!)
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
  const hid = household?.id ?? null
  const key = choresKey(hid)
  const invalidate = () => qc.invalidateQueries({ queryKey: CHORES_KEY })
  const patch = (id: string, p: Partial<Chore>) =>
    qc.setQueryData<Chore[]>(key, (old) => old?.map((c) => (c.id === id ? { ...c, ...p } : c)))
  // Cancel in-flight refetches so a stale response can't clobber the
  // optimistic patch, and snapshot for rollback on error.
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: key })
    return { previous: qc.getQueryData<Chore[]>(key) }
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: Chore[] }) => {
    if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous)
  }

  const addChore = useMutation({
    mutationFn: async (chore: ChoreInsert) => {
      if (!hid) throw new Error('No household')
      const { error } = await supabase.from('chores').insert({ ...chore, household_id: hid })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const updateChore = useMutation({
    mutationFn: async ({ id, patch: p }: { id: string; patch: Partial<Chore> }) => {
      const { error } = await supabase.from('chores').update(p).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch: p }) => {
      const ctx = await snapshot()
      patch(id, p)
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const deleteChore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chores').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const ctx = await snapshot()
      qc.setQueryData<Chore[]>(key, (old) => old?.filter((c) => c.id !== id))
      return ctx
    },
    onError: rollback,
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
      const ctx = await snapshot()
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
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const uncompleteChore = useMutation({
    mutationFn: async (choreId: string) => {
      const { error } = await supabase.rpc('uncomplete_chore', { p_chore_id: choreId })
      if (error) throw error
    },
    onMutate: async (choreId) => {
      const ctx = await snapshot()
      const chore = ctx.previous?.find((c) => c.id === choreId)
      if (!chore) return ctx
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
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  return { addChore, updateChore, deleteChore, completeChore, uncompleteChore }
}
