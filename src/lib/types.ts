import type { IconName } from '../components/Icon'

export type StorageLocation = 'freezer' | 'fridge' | 'shelf'
export type MealType = 'meal' | 'component' | 'ingredient'

export const STORAGE_LOCATIONS: { key: StorageLocation; label: string; icon: IconName }[] = [
  { key: 'freezer', label: 'Freezer', icon: 'snowflake' },
  { key: 'fridge', label: 'Fridge', icon: 'fridge' },
  { key: 'shelf', label: 'Shelf', icon: 'jar' },
]

export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'meal', label: 'Full meal' },
  { key: 'component', label: 'Component' },
  { key: 'ingredient', label: 'Ingredient' },
]

/** The 13 per-serving nutrient columns shared by meals and recipes. */
export interface NutrientValues {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fibre_g: number | null
  sugar_g: number | null
  sat_fat_g: number | null
  sodium_mg: number | null
  iron_mg: number | null
  potassium_mg: number | null
  calcium_mg: number | null
  vit_c_mg: number | null
  vit_d_ug: number | null
}

export interface Meal extends NutrientValues {
  id: string
  name: string
  prep_date: string
  shelf_life_days: number
  storage_location: StorageLocation
  meal_type: MealType
  best_before: string
  servings_per_pack: number
  pack_quantity: number
  initial_pack_quantity: number
  notes: string | null
  recipe_id: string | null
  archived_at: string | null
  household_id: string
  created_by: string | null
  created_at: string
  updated_at: string
}

/** household_id is injected by the mutation hooks from the active household. */
export type MealInsert = Omit<
  Meal,
  | 'id'
  | 'best_before'
  | 'archived_at'
  | 'household_id'
  | 'recipe_id'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
> & { recipe_id?: string | null; household_id?: string }

export interface Recipe extends NutrientValues {
  id: string
  household_id: string
  name: string
  /** one ingredient per line */
  ingredients: string
  instructions: string
  servings_per_pack: number
  default_storage_location: StorageLocation
  default_shelf_life_days: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RecipeInsert = Omit<
  Recipe,
  'id' | 'household_id' | 'created_by' | 'created_at' | 'updated_at'
> & { household_id?: string }

export interface MealLogEntry {
  id: string
  meal_id: string
  packs: number
  kind: 'consume' | 'restock' | 'waste'
  caused_depletion: boolean
  household_id: string
  logged_at: string
  user_id: string | null
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  display_name: string | null
  created_at: string
}

export type PlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const PLAN_SLOTS: { key: PlanSlot; label: string; icon: IconName }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunrise' },
  { key: 'lunch', label: 'Lunch', icon: 'sun' },
  { key: 'dinner', label: 'Dinner', icon: 'moon' },
  { key: 'snack', label: 'Snack', icon: 'apple' },
]

export interface PlanEntry {
  id: string
  household_id: string
  plan_date: string
  slot: PlanSlot
  meal_id: string | null
  title: string | null
  servings: number
  notes: string | null
  completed_at: string | null
  log_id: string | null
  created_by: string | null
  created_at: string
  /** joined inventory meal when meal_id is set */
  meals: Meal | null
}

export type PlanEntryInsert = {
  plan_date: string
  slot: PlanSlot
  meal_id?: string
  title?: string
  servings?: number
  notes?: string | null
  household_id?: string
}

export interface Chore {
  id: string
  household_id: string
  title: string
  notes: string | null
  assigned_to: string | null
  due_date: string | null
  /** null = one-off */
  recur_interval_days: number | null
  completed_at: string | null
  last_completed_at: string | null
  prev_due_date: string | null
  prev_last_completed_at: string | null
  created_by: string | null
  created_at: string
}

export type ChoreInsert = {
  title: string
  notes?: string | null
  assigned_to?: string | null
  due_date?: string | null
  recur_interval_days?: number | null
  household_id?: string
}

export const RECURRENCE_OPTIONS: { label: string; days: number | null }[] = [
  { label: 'One-off', days: null },
  { label: 'Daily', days: 1 },
  { label: 'Weekly', days: 7 },
  { label: 'Every 2 weeks', days: 14 },
  { label: 'Monthly', days: 30 },
]

export interface ShoppingItem {
  id: string
  household_id: string
  name: string
  quantity: string | null
  checked_at: string | null
  sort_order: number
  created_by: string | null
  created_at: string
}

/** Result of the eat_pack RPC. */
export interface EatPackResult {
  log_id: string
  new_qty: number
  depleted: boolean
}

export interface NutrientDef {
  key: keyof NutrientValues
  label: string
  unit: string
  core: boolean
}

export const NUTRIENTS: NutrientDef[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', core: true },
  { key: 'protein_g', label: 'Protein', unit: 'g', core: true },
  { key: 'fat_g', label: 'Fat', unit: 'g', core: true },
  { key: 'carbs_g', label: 'Carbs', unit: 'g', core: true },
  { key: 'fibre_g', label: 'Fibre', unit: 'g', core: false },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', core: false },
  { key: 'sat_fat_g', label: 'Sat. fat', unit: 'g', core: false },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', core: false },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', core: false },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', core: false },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', core: false },
  { key: 'vit_c_mg', label: 'Vitamin C', unit: 'mg', core: false },
  { key: 'vit_d_ug', label: 'Vitamin D', unit: 'µg', core: false },
]

export const CORE_NUTRIENTS = NUTRIENTS.filter((n) => n.core)
export const EXTENDED_NUTRIENTS = NUTRIENTS.filter((n) => !n.core)
