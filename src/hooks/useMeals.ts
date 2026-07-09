import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { EatPackResult, Meal, MealInsert, MealLogEntry } from '../lib/types'
import { urgencySort } from '../lib/freshness'
import { useHousehold } from './useHousehold'

// Keys carry the household id so caches can't bleed across a create/join
// switch; RLS does the actual scoping server-side.
const MEALS_KEY = ['meals']
const LOG_KEY = ['meal_log']
export const mealsKey = (hid: string | null) => [...MEALS_KEY, hid]
export const logKey = (hid: string | null) => [...LOG_KEY, hid]

export function useMeals() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: mealsKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase.from('meals').select('*')
      if (error) throw error
      return (data as Meal[]).sort(urgencySort)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Today's consumption log with meal info, for the Today panel. */
export function useTodayLog() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: [...logKey(hid), 'today'],
    enabled: !!hid,
    queryFn: async () => {
      const since = startOfDay(new Date()).toISOString()
      const { data, error } = await supabase
        .from('meal_log')
        .select('*, meals(*)')
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return data as (MealLogEntry & { meals: Meal })[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Subscribe to realtime changes and invalidate caches (keeps every device live). */
export function useRealtimeSync() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('household-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        qc.invalidateQueries({ queryKey: MEALS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_log' }, () => {
        qc.invalidateQueries({ queryKey: LOG_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => {
        qc.invalidateQueries({ queryKey: ['shopping'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_entries' }, () => {
        qc.invalidateQueries({ queryKey: ['plan'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        qc.invalidateQueries({ queryKey: ['recipes'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, () => {
        qc.invalidateQueries({ queryKey: ['members'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}

function patchMealCache(
  qc: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  id: string,
  patch: Partial<Meal>,
) {
  qc.setQueryData<Meal[]>(key, (old) => old?.map((m) => (m.id === id ? { ...m, ...patch } : m)))
}

export function useMealMutations() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const key = mealsKey(household?.id ?? null)
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: MEALS_KEY })
    qc.invalidateQueries({ queryKey: LOG_KEY })
  }

  const addMeal = useMutation({
    mutationFn: async (meal: MealInsert) => {
      const { data, error } = await supabase.from('meals').insert(meal).select().single()
      if (error) throw error
      return data as Meal
    },
    onSettled: invalidate,
  })

  const updateMeal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Meal> }) => {
      const { error } = await supabase
        .from('meals')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => patchMealCache(qc, key, id, patch),
    onSettled: invalidate,
  })

  /** Consume one pack atomically (decrement + log + auto-archive in one transaction). */
  const eatPack = useMutation({
    mutationFn: async (meal: Meal): Promise<EatPackResult> => {
      const { data, error } = await supabase.rpc('eat_pack', { p_meal_id: meal.id })
      if (error) throw error
      return data as EatPackResult
    },
    onMutate: async (meal) => {
      const newQty = Math.max(meal.pack_quantity - 1, 0)
      patchMealCache(qc, key, meal.id, {
        pack_quantity: newQty,
        archived_at: newQty === 0 ? new Date().toISOString() : meal.archived_at,
      })
    },
    onSettled: invalidate,
  })

  /** Reverse an eat_pack: restore quantity, unarchive if the eat archived it, drop the log row. */
  const undoEat = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.rpc('undo_eat', { p_log_id: logId })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const archiveMeal = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('meals')
        .update({
          archived_at: archived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, archived }) =>
      patchMealCache(qc, key, id, { archived_at: archived ? new Date().toISOString() : null }),
    onSettled: invalidate,
  })

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      qc.setQueryData<Meal[]>(key, (old) => old?.filter((m) => m.id !== id))
    },
    onSettled: invalidate,
  })

  return { addMeal, updateMeal, eatPack, undoEat, archiveMeal, deleteMeal }
}
