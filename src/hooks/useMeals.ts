import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Meal, MealInsert, MealLogEntry } from '../lib/types'
import { urgencySort } from '../lib/freshness'

const MEALS_KEY = ['meals']
const LOG_KEY = ['meal_log']

export function useMeals() {
  return useQuery({
    queryKey: MEALS_KEY,
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
  return useQuery({
    queryKey: [...LOG_KEY, 'today'],
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

/** Subscribe to realtime changes and invalidate caches (keeps kiosk live). */
export function useRealtimeMeals() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('meals-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        qc.invalidateQueries({ queryKey: MEALS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_log' }, () => {
        qc.invalidateQueries({ queryKey: LOG_KEY })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}

function patchMealCache(qc: ReturnType<typeof useQueryClient>, id: string, patch: Partial<Meal>) {
  qc.setQueryData<Meal[]>(MEALS_KEY, (old) =>
    old?.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  )
}

export function useMealMutations() {
  const qc = useQueryClient()
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
    onMutate: async ({ id, patch }) => patchMealCache(qc, id, patch),
    onSettled: invalidate,
  })

  /** Consume one pack: decrement, log, auto-archive at zero. Returns undo info. */
  const eatPack = useMutation({
    mutationFn: async (meal: Meal) => {
      const newQty = Math.max(meal.pack_quantity - 1, 0)
      const depleted = newQty === 0
      const { error } = await supabase
        .from('meals')
        .update({
          pack_quantity: newQty,
          archived_at: depleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meal.id)
      if (error) throw error
      const { data: log, error: logErr } = await supabase
        .from('meal_log')
        .insert({ meal_id: meal.id, packs: 1 })
        .select()
        .single()
      if (logErr) throw logErr
      return { logId: (log as MealLogEntry).id, newQty, depleted }
    },
    onMutate: async (meal) => {
      const newQty = Math.max(meal.pack_quantity - 1, 0)
      patchMealCache(qc, meal.id, {
        pack_quantity: newQty,
        archived_at: newQty === 0 ? new Date().toISOString() : null,
      })
    },
    onSettled: invalidate,
  })

  /** Reverse an eatPack: restore quantity, unarchive, delete the log row. */
  const undoEat = useMutation({
    mutationFn: async ({ meal, logId }: { meal: Meal; logId: string }) => {
      const { error } = await supabase
        .from('meals')
        .update({
          pack_quantity: meal.pack_quantity,
          archived_at: meal.archived_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meal.id)
      if (error) throw error
      await supabase.from('meal_log').delete().eq('id', logId)
    },
    onMutate: async ({ meal }) =>
      patchMealCache(qc, meal.id, {
        pack_quantity: meal.pack_quantity,
        archived_at: meal.archived_at,
      }),
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
      patchMealCache(qc, id, { archived_at: archived ? new Date().toISOString() : null }),
    onSettled: invalidate,
  })

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      qc.setQueryData<Meal[]>(MEALS_KEY, (old) => old?.filter((m) => m.id !== id))
    },
    onSettled: invalidate,
  })

  return { addMeal, updateMeal, eatPack, undoEat, archiveMeal, deleteMeal }
}
