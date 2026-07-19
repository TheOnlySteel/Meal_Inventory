import { useMemo, useState } from 'react'
import { useRecipes, useRecipeMutations, ingredientLines } from '../hooks/useRecipes'
import { useMeals, useMealMutations } from '../hooks/useMeals'
import { useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import type { Meal, MealInsert, Recipe, RecipeInsert, StorageLocation } from '../lib/types'
import { STORAGE_LOCATIONS } from '../lib/types'
import { DEFAULT_LIFE, daysFromLife } from '../lib/shelfLife'
import { fmtNum, todayISO } from '../lib/format'
import RecipeDetailSheet from '../components/RecipeDetailSheet'
import RecipeFormSheet from '../components/RecipeFormSheet'
import ImportRecipeSheet from '../components/ImportRecipeSheet'
import MealFormSheet from '../components/MealFormSheet'
import Icon from '../components/Icon'
import ConfirmSheet from '../components/ConfirmSheet'
import { fetchImageBlob, recipePhotoUrl, uploadRecipePhoto } from '../lib/photos'

/** Meal-shaped template so MealFormSheet opens prefilled from a recipe. */
function mealTemplateFromRecipe(r: Recipe, loc: StorageLocation): Meal {
  return {
    id: '',
    household_id: '',
    created_by: null,
    created_at: '',
    updated_at: '',
    best_before: '',
    archived_at: null,
    name: r.name,
    prep_date: todayISO(),
    meal_type: 'meal',
    storage_location: loc,
    shelf_life_days:
      loc === r.default_storage_location
        ? r.default_shelf_life_days
        : daysFromLife(DEFAULT_LIFE[loc], loc),
    servings_per_pack: Number(r.servings_per_pack),
    pack_quantity: 4,
    initial_pack_quantity: 4,
    notes: r.notes,
    recipe_id: r.id,
    calories: r.calories,
    protein_g: r.protein_g,
    fat_g: r.fat_g,
    carbs_g: r.carbs_g,
    fibre_g: r.fibre_g,
    sugar_g: r.sugar_g,
    sat_fat_g: r.sat_fat_g,
    sodium_mg: r.sodium_mg,
    iron_mg: r.iron_mg,
    potassium_mg: r.potassium_mg,
    calcium_mg: r.calcium_mg,
    vit_c_mg: r.vit_c_mg,
    vit_d_ug: r.vit_d_ug,
  }
}

export default function Recipes() {
  const { data: recipes, isLoading, error } = useRecipes()
  const { addRecipe, updateRecipe, deleteRecipe } = useRecipeMutations()
  const { data: meals } = useMeals()
  const { addMeal } = useMealMutations()
  const { addItems, removeItems } = useShoppingMutations()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importTemplate, setImportTemplate] = useState<Partial<Recipe> | null>(null)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [larderTemplate, setLarderTemplate] = useState<Meal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null)

  const allTags = useMemo(
    () => [...new Set((recipes ?? []).flatMap((r) => r.tags))].sort(),
    [recipes],
  )

  const visible = useMemo(() => {
    let all = recipes ?? []
    if (tagFilter) all = all.filter((r) => r.tags.includes(tagFilter))
    const q = search.trim().toLowerCase()
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all
  }, [recipes, search, tagFilter])

  const detail = detailId ? ((recipes ?? []).find((r) => r.id === detailId) ?? null) : null

  // Photo failures don't block the save — the recipe row already exists.
  async function attachPhoto(recipeId: string, householdId: string, blob: Blob) {
    try {
      const path = await uploadRecipePhoto(householdId, recipeId, blob)
      await updateRecipe.mutateAsync({ id: recipeId, patch: { photo_path: path } })
    } catch {
      toast('Photo upload failed', { tone: 'error' })
    }
  }

  // Awaited by the form sheets: they stay open on failure, close on success.
  async function handleSaveRecipe(values: RecipeInsert, editingId?: string, photo?: File | null) {
    if (editingId) {
      await updateRecipe.mutateAsync({ id: editingId, patch: values })
      const existing = (recipes ?? []).find((r) => r.id === editingId)
      if (photo && existing) await attachPhoto(editingId, existing.household_id, photo)
    } else {
      const r = await addRecipe.mutateAsync(values)
      toast(`Added ${r.name}`)
      setDetailId(r.id)
      // Prefer a hand-picked photo; otherwise try the imported page's image
      const blob = photo ?? (pendingImageUrl ? await fetchImageBlob(pendingImageUrl) : null)
      if (blob) await attachPhoto(r.id, r.household_id, blob)
      setPendingImageUrl(null)
    }
  }

  function handleSendToLarder(recipe: Recipe, loc: StorageLocation) {
    setLarderTemplate(mealTemplateFromRecipe(recipe, loc))
  }

  async function handleSaveMeal(values: MealInsert) {
    await addMeal.mutateAsync(values)
    toast(`Added ${values.name} to the larder`)
  }

  function handleIngredientsToShopping(lines: string[]) {
    if (lines.length === 0) return
    addItems.mutate(lines, {
      onSuccess: (rows) => {
        toast(`Added ${rows.length} item${rows.length === 1 ? '' : 's'} to shopping`, {
          undo: () => removeItems.mutate(rows.map((r) => r.id)),
        })
      },
      onError: () => toast('Could not add', { tone: 'error' }),
    })
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h1 className="text-[28px] font-bold tracking-tight">Recipes</h1>
          <button
            onClick={() => setImportOpen(true)}
            className="pressable rounded-full bg-card2 px-4 py-1.5 text-[13px] font-semibold text-tint"
          >
            Import from web
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes"
            className="w-full rounded-xl bg-card2 px-4 py-2 text-[16px] outline-none placeholder:text-ink3 focus:ring-2 focus:ring-tint/50"
          />
          {allTags.length > 0 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => setTagFilter(null)}
                className={`pressable shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  tagFilter == null ? 'bg-tint text-white' : 'bg-card2 text-ink2'
                }`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
                  className={`pressable shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    tagFilter === t ? 'bg-tint text-white' : 'bg-card2 text-ink2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-4 pb-[calc(var(--bottom-clearance)+4.5rem)]">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-[72px] w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load recipes. Check connection.
          </p>
        )}

        {!isLoading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Icon name="book" size={52} strokeWidth={1.1} className="text-ink3" />
            <p className="text-[17px] font-semibold">
              {search ? 'No recipes match' : 'No recipes yet'}
            </p>
            {!search && (
              <p className="max-w-64 text-[14px] text-ink2">
                Save your go-to preps as recipes, then send each batch straight to the larder.
              </p>
            )}
          </div>
        )}

        {visible.map((recipe) => {
          const loc = STORAGE_LOCATIONS.find((l) => l.key === recipe.default_storage_location)
          const lineCount = ingredientLines(recipe).length
          const photo = recipePhotoUrl(recipe.photo_path)
          return (
            <button
              key={recipe.id}
              onClick={() => setDetailId(recipe.id)}
              className="pop-in pressable flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left card-shadow"
            >
              {photo && (
                <img
                  src={photo}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[17px] leading-tight font-semibold">{recipe.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink2">
                  {loc ? <Icon name={loc.icon} size={13} /> : null} {loc?.label}
                  {recipe.calories != null ? (
                    <> · {fmtNum(recipe.calories)} kcal/serv</>
                  ) : null}
                  {lineCount > 0 ? (
                    <> · {lineCount} ingredient{lineCount === 1 ? '' : 's'}</>
                  ) : null}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0 text-ink3">
                <path
                  d="M9 5.5 15.5 12 9 18.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        })}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        aria-label="New recipe"
        className="pressable fixed right-5 bottom-[var(--bottom-clearance)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-tint text-white float-shadow"
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {detail && (
        <RecipeDetailSheet
          recipe={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditing(detail)
            setFormOpen(true)
          }}
          onDelete={() => setConfirmDelete(detail)}
          onSendToLarder={(loc) => handleSendToLarder(detail, loc)}
          onIngredientsToShopping={handleIngredientsToShopping}
        />
      )}

      {importOpen && (
        <ImportRecipeSheet
          onClose={() => setImportOpen(false)}
          onImported={(template, imageUrl) => {
            setImportTemplate(template)
            setPendingImageUrl(imageUrl)
            setEditing(null)
            setFormOpen(true)
          }}
        />
      )}

      {formOpen && (
        <RecipeFormSheet
          editing={editing}
          template={importTemplate}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
            setImportTemplate(null)
            setPendingImageUrl(null)
          }}
          onSave={handleSaveRecipe}
        />
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={`Delete “${confirmDelete.name}”?`}
          message="Meals made from it stay in the larder."
          confirmLabel="Delete Recipe"
          onConfirm={() => {
            setDetailId(null)
            deleteRecipe.mutate(confirmDelete.id)
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {/* Stacked above the detail sheet (later in DOM) */}
      {larderTemplate && (
        <MealFormSheet
          template={larderTemplate}
          history={meals ?? []}
          onClose={() => setLarderTemplate(null)}
          onSave={handleSaveMeal}
        />
      )}
    </div>
  )
}
