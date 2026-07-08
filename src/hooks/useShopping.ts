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
  const key = shoppingKey(household?.id ?? null)
  const invalidate = () => qc.invalidateQueries({ queryKey: SHOPPING_KEY })
  const patch = (fn: (old: ShoppingItem[]) => ShoppingItem[]) =>
    qc.setQueryData<ShoppingItem[]>(key, (old) => (old ? fn(old) : old))

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('shopping_items').insert({ name: name.trim() })
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
    onMutate: async ({ id, checked }) =>
      patch((old) =>
        old.map((i) =>
          i.id === id ? { ...i, checked_at: checked ? new Date().toISOString() : null } : i,
        ),
      ),
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
      const ids = new Set(items.map((i) => i.id))
      patch((old) => old.filter((i) => !ids.has(i.id)))
    },
    onSettled: invalidate,
  })

  /** Re-insert previously cleared items (undo for clearChecked). */
  const restoreItems = useMutation({
    mutationFn: async (items: ShoppingItem[]) => {
      const rows = items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        checked_at: i.checked_at,
        sort_order: i.sort_order,
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
    onMutate: async (id) => patch((old) => old.filter((i) => i.id !== id)),
    onSettled: invalidate,
  })

  return { addItem, setChecked, clearChecked, restoreItems, deleteItem }
}
