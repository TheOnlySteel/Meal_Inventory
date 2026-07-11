import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Recipe, RecipeInsert } from '../lib/types'
import { useHousehold } from './useHousehold'

const RECIPES_KEY = ['recipes']
export const recipesKey = (hid: string | null) => [...RECIPES_KEY, hid]

export function useRecipes() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: recipesKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', hid!)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Recipe[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useRecipeMutations() {
  const qc = useQueryClient()
  const { household } = useHousehold()
  const hid = household?.id ?? null
  const key = recipesKey(hid)
  const invalidate = () => qc.invalidateQueries({ queryKey: RECIPES_KEY })

  const addRecipe = useMutation({
    mutationFn: async (recipe: RecipeInsert): Promise<Recipe> => {
      if (!hid) throw new Error('No household')
      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...recipe, household_id: hid })
        .select()
        .single()
      if (error) throw error
      return data as Recipe
    },
    onSettled: invalidate,
  })

  const updateRecipe = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Recipe> }) => {
      const { error } = await supabase
        .from('recipes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) =>
      qc.setQueryData<Recipe[]>(key, (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      ),
    onSettled: invalidate,
  })

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) =>
      qc.setQueryData<Recipe[]>(key, (old) => old?.filter((r) => r.id !== id)),
    onSettled: invalidate,
  })

  return { addRecipe, updateRecipe, deleteRecipe }
}

/** Non-empty trimmed ingredient lines of a recipe. */
export function ingredientLines(recipe: Recipe): string[] {
  return recipe.ingredients
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}
