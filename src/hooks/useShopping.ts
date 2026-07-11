import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ShoppingItem } from '../lib/types'
import { useHousehold } from './useHousehold'

const SHOPPING_KEY = ['shopping']
export const shoppingKey = (hid: string | null) => [...SHOPPING_KEY, hid]

export function useShopping() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: shoppingKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', hid!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ShoppingItem[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useShoppingMutations() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const hid = household?.id ?? null
  const key = shoppingKey(hid)
  const invalidate = () => qc.invalidateQueries({ queryKey: SHOPPING_KEY })
  const patch = (fn: (old: ShoppingItem[]) => ShoppingItem[]) =>
    qc.setQueryData<ShoppingItem[]>(key, (old) => (old ? fn(old) : old))
  // Cancel in-flight refetches so a stale response can't clobber the
  // optimistic patch, and snapshot for rollback on error.
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: key })
    return { previous: qc.getQueryData<ShoppingItem[]>(key) }
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: ShoppingItem[] }) => {
    if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous)
  }

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      if (!hid) throw new Error('No household')
      const { error } = await supabase
        .from('shopping_items')
        .insert({ name: name.trim(), household_id: hid })
      if (error) throw error
    },
    onSettled: invalidate,
  })

  /** Bulk add (e.g. recipe ingredients); returns rows so callers can offer undo. */
  const addItems = useMutation({
    mutationFn: async (names: string[]): Promise<ShoppingItem[]> => {
      if (!hid) throw new Error('No household')
      const rows = names.map((name) => ({ name, household_id: hid }))
      const { data, error } = await supabase.from('shopping_items').insert(rows).select()
      if (error) throw error
      return data as ShoppingItem[]
    },
    onSettled: invalidate,
  })

  /** Undo helper for addItems. */
  const removeItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('shopping_items').delete().in('id', ids)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const setChecked = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_items')
        .update({ checked_at: checked ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, checked }) => {
      const ctx = await snapshot()
      patch((old) =>
        old.map((i) =>
          i.id === id ? { ...i, checked_at: checked ? new Date().toISOString() : null } : i,
        ),
      )
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Deletes all checked items; returns them so the caller can offer undo. */
  const clearChecked = useMutation({
    mutationFn: async (items: ShoppingItem[]) => {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .in('id', items.map((i) => i.id))
      if (error) throw error
      return items
    },
    onMutate: async (items) => {
      const ctx = await snapshot()
      const ids = new Set(items.map((i) => i.id))
      patch((old) => old.filter((i) => !ids.has(i.id)))
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Re-insert previously cleared items (undo for clearChecked). */
  const restoreItems = useMutation({
    mutationFn: async (items: ShoppingItem[]) => {
      if (!hid) throw new Error('No household')
      const rows = items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        checked_at: i.checked_at,
        sort_order: i.sort_order,
        household_id: hid,
      }))
      const { error } = await supabase.from('shopping_items').insert(rows)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const ctx = await snapshot()
      patch((old) => old.filter((i) => i.id !== id))
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  return { addItem, addItems, removeItems, setChecked, clearChecked, restoreItems, deleteItem }
}
