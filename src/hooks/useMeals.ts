import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { EatPackResult, Meal, MealInsert, MealLogEntry } from '../lib/types'
import { urgencySort } from '../lib/freshness'
import { useHousehold } from './useHousehold'

// Keys carry the household id so caches can't bleed across a create/join
// switch. Queries and inserts also pass household_id explicitly so reads and
// writes stay pinned to the active household (RLS still enforces membership).
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
      const { data, error } = await supabase.from('meals').select('*').eq('household_id', hid!)
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
        .eq('household_id', hid!)
        .eq('kind', 'consume')
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return data as (MealLogEntry & { meals: Meal })[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Packs marked as waste in the last 30 days (for the Larder stats strip). */
export function useWaste30d() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: [...logKey(hid), 'waste30'],
    enabled: !!hid,
    queryFn: async (): Promise<number> => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('meal_log')
        .select('packs')
        .eq('household_id', hid!)
        .eq('kind', 'waste')
        .gte('logged_at', since)
      if (error) throw error
      return (data as { packs: number }[]).reduce((s, r) => s + r.packs, 0)
    },
    staleTime: 60_000,
  })
}

/** Subscribe to realtime changes and invalidate caches (keeps every device live). */
export function useRealtimeSync() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const hid = household?.id ?? null
  useEffect(() => {
    if (!hid) return
    const channel = supabase
      .channel(`household-live-${hid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        qc.invalidateQueries({ queryKey: MEALS_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_log' }, () => {
        qc.invalidateQueries({ queryKey: LOG_KEY })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => {
        qc.invalidateQueries({ queryKey: ['shopping'] })
        qc.invalidateQueries({ queryKey: ['catalog'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_catalog' }, () => {
        qc.invalidateQueries({ queryKey: ['catalog'] })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores' }, () => {
        qc.invalidateQueries({ queryKey: ['chores'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc, hid])
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
  const hid = household?.id ?? null
  const key = mealsKey(hid)
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: MEALS_KEY })
    qc.invalidateQueries({ queryKey: LOG_KEY })
  }
  // Cancel in-flight refetches (60s polling + focus refetch) so a stale
  // response can't clobber the optimistic patch, and snapshot for rollback.
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: key })
    return { previous: qc.getQueryData<Meal[]>(key) }
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: Meal[] }) => {
    if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous)
  }

  const addMeal = useMutation({
    mutationFn: async (meal: MealInsert) => {
      if (!hid) throw new Error('No household')
      const { data, error } = await supabase
        .from('meals')
        .insert({ ...meal, household_id: hid })
        .select()
        .single()
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
    onMutate: async ({ id, patch }) => {
      const ctx = await snapshot()
      patchMealCache(qc, key, id, patch)
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Consume packs atomically (decrement + log + auto-archive in one transaction). */
  const eatPack = useMutation({
    mutationFn: async ({ meal, packs }: { meal: Meal; packs: number }): Promise<EatPackResult> => {
      const { data, error } = await supabase.rpc('eat_pack', {
        p_meal_id: meal.id,
        p_packs: packs,
      })
      if (error) throw error
      return data as EatPackResult
    },
    onMutate: async ({ meal, packs }) => {
      const ctx = await snapshot()
      const newQty = Math.max(meal.pack_quantity - packs, 0)
      patchMealCache(qc, key, meal.id, {
        pack_quantity: newQty,
        archived_at: newQty === 0 ? new Date().toISOString() : meal.archived_at,
      })
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Restock or waste packs (kind decides direction); same guards as eat_pack. */
  const adjustStock = useMutation({
    mutationFn: async ({
      meal,
      packs,
      kind,
    }: {
      meal: Meal
      packs: number
      kind: 'restock' | 'waste'
    }): Promise<EatPackResult> => {
      const { data, error } = await supabase.rpc('adjust_stock', {
        p_meal_id: meal.id,
        p_packs: packs,
        p_kind: kind,
      })
      if (error) throw error
      return data as EatPackResult
    },
    onMutate: async ({ meal, packs, kind }) => {
      const ctx = await snapshot()
      if (kind === 'restock') {
        const newQty = meal.pack_quantity + packs
        patchMealCache(qc, key, meal.id, {
          pack_quantity: newQty,
          initial_pack_quantity: Math.max(meal.initial_pack_quantity, newQty),
          archived_at: null,
        })
      } else {
        const newQty = Math.max(meal.pack_quantity - packs, 0)
        patchMealCache(qc, key, meal.id, {
          pack_quantity: newQty,
          archived_at: newQty === 0 ? new Date().toISOString() : meal.archived_at,
        })
      }
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Reverse any stock event (consume, restock, or waste) from its log row. */
  const undoEat = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.rpc('undo_stock_event', { p_log_id: logId })
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
    onMutate: async ({ id, archived }) => {
      const ctx = await snapshot()
      patchMealCache(qc, key, id, { archived_at: archived ? new Date().toISOString() : null })
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const ctx = await snapshot()
      qc.setQueryData<Meal[]>(key, (old) => old?.filter((m) => m.id !== id))
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  return { addMeal, updateMeal, eatPack, adjustStock, undoEat, archiveMeal, deleteMeal }
}
