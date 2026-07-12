import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CatalogItem, ShoppingItem } from '../lib/types'
import { mergeQuantities, nameKey, parseItemInput } from '../lib/groceries'
import { useHousehold } from './useHousehold'

const SHOPPING_KEY = ['shopping']
const CATALOG_KEY = ['catalog']
export const shoppingKey = (hid: string | null) => [...SHOPPING_KEY, hid]
export const catalogKey = (hid: string | null) => [...CATALOG_KEY, hid]

/** The household's remembered items (store/aisle/frequency per name). */
export function useCatalog() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: catalogKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from('item_catalog')
        .select('*')
        .eq('household_id', hid!)
      if (error) throw error
      return data as CatalogItem[]
    },
    staleTime: 60_000,
  })
}

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

  const invalidateAll = () => {
    invalidate()
    qc.invalidateQueries({ queryKey: CATALOG_KEY })
  }

  /** Store/category memory for a name: cache first, single-row fetch as fallback. */
  const lookupCatalog = async (key: string): Promise<CatalogItem | undefined> => {
    const cached = qc.getQueryData<CatalogItem[]>(catalogKey(hid))
    if (cached) return cached.find((c) => c.name_key === key)
    const { data } = await supabase
      .from('item_catalog')
      .select('*')
      .eq('household_id', hid!)
      .eq('name_key', key)
      .maybeSingle()
    return (data as CatalogItem | null) ?? undefined
  }

  /**
   * Add from free text: parses a leading/trailing quantity, resolves the
   * remembered store/aisle (explicit store wins), and merges into an existing
   * open row for the same item instead of duplicating.
   */
  const addItem = useMutation({
    mutationFn: async ({ raw, store }: { raw: string; store?: string }) => {
      if (!hid) throw new Error('No household')
      const { name, quantity } = parseItemInput(raw)
      const key = nameKey(name)
      const learned = await lookupCatalog(key)
      const finalStore = store ?? learned?.store ?? 'grocery'
      const existing = qc
        .getQueryData<ShoppingItem[]>(shoppingKey(hid))
        ?.find((i) => i.checked_at == null && nameKey(i.name) === key && i.store === finalStore)
      if (existing) {
        const merged = mergeQuantities(existing.quantity, quantity)
        const { error } = await supabase
          .from('shopping_items')
          .update({ quantity: merged ?? quantity ?? existing.quantity })
          .eq('id', existing.id)
        if (error) throw error
        return { merged: true as const, name }
      }
      const { error } = await supabase.from('shopping_items').insert({
        name,
        quantity,
        store: finalStore,
        category: learned?.category ?? null,
        household_id: hid,
      })
      if (error) throw error
      return { merged: false as const, name }
    },
    onSettled: invalidateAll,
  })

  /** Bulk add (e.g. recipe ingredients); returns rows so callers can offer undo. */
  const addItems = useMutation({
    mutationFn: async (names: string[]): Promise<ShoppingItem[]> => {
      if (!hid) throw new Error('No household')
      const catalog = qc.getQueryData<CatalogItem[]>(catalogKey(hid))
      const rows = names.map((raw) => {
        const { name, quantity } = parseItemInput(raw)
        const learned = catalog?.find((c) => c.name_key === nameKey(name))
        return {
          name,
          quantity,
          store: learned?.store ?? 'grocery',
          category: learned?.category ?? null,
          household_id: hid,
        }
      })
      const { data, error } = await supabase.from('shopping_items').insert(rows).select()
      if (error) throw error
      return data as ShoppingItem[]
    },
    onSettled: invalidateAll,
  })

  /** Edit an item in place (rename, quantity, or its store/aisle assignment). */
  const updateItem = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<ShoppingItem, 'name' | 'quantity' | 'store' | 'category'>>
    }) => {
      const { error } = await supabase.from('shopping_items').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch: p }) => {
      const ctx = await snapshot()
      patch((old) => old.map((i) => (i.id === id ? { ...i, ...p } : i)))
      return ctx
    },
    onError: rollback,
    onSettled: invalidate,
  })

  /** Correct the catalog memory after the user reassigns an item's store/aisle. */
  const rememberItem = useMutation({
    mutationFn: async ({
      name,
      patch: p,
    }: {
      name: string
      patch: { store?: string; category?: string | null }
    }) => {
      if (!hid) throw new Error('No household')
      const { error } = await supabase
        .from('item_catalog')
        .update(p)
        .eq('household_id', hid)
        .eq('name_key', nameKey(name))
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
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
        store: i.store,
        category: i.category,
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

  return {
    addItem,
    addItems,
    removeItems,
    updateItem,
    rememberItem,
    setChecked,
    clearChecked,
    restoreItems,
    deleteItem,
  }
}
