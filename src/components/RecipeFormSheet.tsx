import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { NutrientValues, Recipe, RecipeInsert, StorageLocation } from '../lib/types'
import { NUTRIENTS, STORAGE_LOCATIONS } from '../lib/types'
import { DEFAULT_LIFE, daysFromLife, lifeFromDays, usesWeeks } from '../lib/shelfLife'
import { recipePhotoUrl } from '../lib/photos'
import NutrientFields from './NutrientFields'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  editing?: Recipe | null
  /** Prefill for "save meal as recipe" / URL import. */
  template?: Partial<Recipe> | null
  onClose: () => void
  /** Resolves on success (the sheet closes itself); rejection keeps it open. */
  onSave: (values: RecipeInsert, editingId?: string, photo?: File | null) => Promise<void>
}

function toFormNums(src: Partial<Recipe> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!src) return out
  for (const n of NUTRIENTS) {
    const v = src[n.key]
    out[n.key] = v == null ? '' : String(v)
  }
  return out
}

export default function RecipeFormSheet({ editing, template, onClose, onSave }: Props) {
  const base = editing ?? template ?? null
  const [name, setName] = useState(base?.name ?? '')
  const [ingredients, setIngredients] = useState(base?.ingredients ?? '')
  const [instructions, setInstructions] = useState(base?.instructions ?? '')
  const [servings, setServings] = useState(String(base?.servings_per_pack ?? 1))
  const [location, setLocation] = useState<StorageLocation>(
    base?.default_storage_location ?? 'freezer',
  )
  const [shelfLife, setShelfLife] = useState(() =>
    base?.default_shelf_life_days != null
      ? lifeFromDays(base.default_shelf_life_days, base.default_storage_location ?? 'freezer')
      : DEFAULT_LIFE.freezer,
  )
  const [lifeTouched, setLifeTouched] = useState(base?.default_shelf_life_days != null)
  const [notes, setNotes] = useState(base?.notes ?? '')
  const [nums, setNums] = useState<Record<string, string>>(toFormNums(base))
  const [tagsText, setTagsText] = useState((base?.tags ?? []).join(', '))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : recipePhotoUrl(base?.photo_path ?? null)),
    [photoFile, base],
  )
  useEffect(() => {
    if (!photoFile || !photoPreview) return
    return () => URL.revokeObjectURL(photoPreview)
  }, [photoFile, photoPreview])

  const shelfDays = daysFromLife(shelfLife, location)

  function switchLocation(next: StorageLocation) {
    if (next === location) return
    if (!lifeTouched) {
      setShelfLife(DEFAULT_LIFE[next])
    } else if (usesWeeks(location) !== usesWeeks(next) && shelfDays > 0) {
      setShelfLife(lifeFromDays(shelfDays, next))
    }
    setLocation(next)
  }

  function setNum(key: keyof NutrientValues, v: string) {
    setNums((s) => ({ ...s, [key]: v }))
  }

  function numOrNull(key: keyof NutrientValues): number | null {
    const raw = nums[key]
    if (raw == null || raw.trim() === '') return null
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : null
  }

  async function submit(e: FormEvent, close: () => void) {
    e.preventDefault()
    if (saving) return
    const values: RecipeInsert = {
      name: name.trim(),
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      servings_per_pack: parseFloat(servings) || 1,
      default_storage_location: location,
      default_shelf_life_days: shelfDays || 1,
      notes: notes.trim() || null,
      calories: numOrNull('calories'),
      protein_g: numOrNull('protein_g'),
      fat_g: numOrNull('fat_g'),
      carbs_g: numOrNull('carbs_g'),
      fibre_g: numOrNull('fibre_g'),
      sugar_g: numOrNull('sugar_g'),
      sat_fat_g: numOrNull('sat_fat_g'),
      sodium_mg: numOrNull('sodium_mg'),
      iron_mg: numOrNull('iron_mg'),
      potassium_mg: numOrNull('potassium_mg'),
      calcium_mg: numOrNull('calcium_mg'),
      vit_c_mg: numOrNull('vit_c_mg'),
      vit_d_ug: numOrNull('vit_d_ug'),
      tags: [
        ...new Set(
          tagsText
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(values, editing?.id, photoFile)
      close()
    } catch {
      setSaveError('Couldn’t save — check your connection and try again')
      setSaving(false)
    }
  }

  const inputCls =
    'rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60 w-full'
  const labelCls = 'text-[13px] font-medium text-ink2'

  return (
    <Sheet
      onClose={onClose}
      ariaLabel={editing ? 'Edit recipe' : 'New recipe'}
      panelClassName="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
      <form onSubmit={(e) => submit(e, close)} className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" onClick={close} className="pressable text-[16px] text-tint">
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold">{editing ? 'Edit recipe' : 'New recipe'}</h2>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="pressable text-[16px] font-semibold text-tint disabled:opacity-40"
          >
            {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
          </button>
        </div>

        {saveError && (
          <p role="alert" className="px-5 pb-1 text-[13px]" style={{ color: 'var(--red)' }}>
            {saveError}
          </p>
        )}

        <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-8 safe-b">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Name</span>
            <input
              className={inputCls}
              value={name}
              required
              data-autofocus={(!editing && !template) || undefined}
              placeholder="e.g. Cinnamon buns"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="h-16 w-24 shrink-0 rounded-xl object-cover card-shadow"
              />
            ) : (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-card2">
                <Icon name="book" size={22} className="text-ink3" />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="pressable rounded-xl bg-card2 px-4 py-2.5 text-[14px] font-semibold text-tint"
            >
              {photoPreview ? 'Replace photo' : 'Add photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tags — comma separated</span>
            <input
              className={inputCls}
              value={tagsText}
              placeholder="weeknight, batch-friendly, veggie"
              onChange={(e) => setTagsText(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Ingredients — one per line</span>
            <textarea
              className={`${inputCls} resize-none`}
              rows={6}
              value={ingredients}
              placeholder={'500g flour\n2 tsp cinnamon\n…'}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Instructions</span>
            <textarea
              className={`${inputCls} resize-none`}
              rows={6}
              value={instructions}
              placeholder="Steps, oven temps, timings…"
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Usually stored in</span>
            <div className="flex rounded-xl bg-card2 p-0.5">
              {STORAGE_LOCATIONS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => switchLocation(l.key)}
                  className={`pressable flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                    location === l.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
                  }`}
                >
                  <Icon name={l.icon} size={15} /> {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>
                Shelf life ({usesWeeks(location) ? 'weeks' : 'days'})
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={usesWeeks(location) ? '0.5' : '1'}
                min={usesWeeks(location) ? '0.5' : '1'}
                className={inputCls}
                value={shelfLife}
                required
                onChange={(e) => {
                  setShelfLife(e.target.value)
                  setLifeTouched(true)
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Servings per pack</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0.5"
                className={inputCls}
                value={servings}
                required
                onChange={(e) => setServings(e.target.value)}
              />
            </label>
          </div>

          <NutrientFields nums={nums} onChange={setNum} />

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Notes</span>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={notes}
              placeholder="Source, variations…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </form>
      )}
    </Sheet>
  )
}
