import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import type { Meal, MealInsert, MealType, NutrientDef, StorageLocation } from '../lib/types'
import { CORE_NUTRIENTS, EXTENDED_NUTRIENTS, MEAL_TYPES, STORAGE_LOCATIONS } from '../lib/types'
import { fmtDateFull, todayISO } from '../lib/format'
import { DEFAULT_LIFE, daysFromLife, lifeFromDays, usesWeeks } from '../lib/shelfLife'
import NutrientFields from './NutrientFields'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  /** Existing meal → edit mode; template (from re-prep/autocomplete) prefills a new meal. */
  editing?: Meal | null
  template?: Meal | null
  /** All meals (incl. archived) for name autocomplete. */
  history: Meal[]
  onClose: () => void
  onSave: (values: MealInsert, editingId?: string) => void
}

type NumField = NutrientDef['key']

function toFormNums(meal: Meal | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!meal) return out
  for (const n of [...CORE_NUTRIENTS, ...EXTENDED_NUTRIENTS]) {
    const v = meal[n.key]
    out[n.key] = v == null ? '' : String(v)
  }
  return out
}

export default function MealFormSheet({ editing, template, history, onClose, onSave }: Props) {
  const base = editing ?? template ?? null
  const [name, setName] = useState(base?.name ?? '')
  const [prepDate, setPrepDate] = useState(editing?.prep_date ?? todayISO())
  const [location, setLocation] = useState<StorageLocation>(base?.storage_location ?? 'freezer')
  const [mealType, setMealType] = useState<MealType>(base?.meal_type ?? 'meal')
  const [shelfLife, setShelfLife] = useState(() =>
    base ? lifeFromDays(base.shelf_life_days, base.storage_location) : DEFAULT_LIFE.freezer,
  )
  const [lifeTouched, setLifeTouched] = useState(base != null)
  const [servings, setServings] = useState(String(base?.servings_per_pack ?? 1))
  const [packs, setPacks] = useState(String(editing?.pack_quantity ?? base?.initial_pack_quantity ?? 4))
  const [notes, setNotes] = useState(base?.notes ?? '')
  const [nums, setNums] = useState<Record<string, string>>(toFormNums(base))
  const [nutrientsExpanded, setNutrientsExpanded] = useState(
    EXTENDED_NUTRIENTS.some((n) => base?.[n.key] != null),
  )
  const [showSuggestions, setShowSuggestions] = useState(false)

  const shelfDays = daysFromLife(shelfLife, location)

  const bestBefore = useMemo(() => {
    if (!prepDate || shelfDays <= 0) return null
    return addDays(parseISO(prepDate), shelfDays)
  }, [prepDate, shelfDays])

  function switchLocation(next: StorageLocation) {
    if (next === location) return
    if (!lifeTouched) {
      setShelfLife(DEFAULT_LIFE[next])
    } else if (usesWeeks(location) !== usesWeeks(next) && shelfDays > 0) {
      setShelfLife(lifeFromDays(shelfDays, next))
    }
    setLocation(next)
  }

  // Autocomplete: latest meal per distinct name matching the query
  const suggestions = useMemo(() => {
    if (editing || name.trim().length < 2) return []
    const q = name.trim().toLowerCase()
    const seen = new Set<string>()
    const out: Meal[] = []
    for (const m of [...history].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const key = m.name.toLowerCase()
      if (key.includes(q) && key !== q && !seen.has(key)) {
        seen.add(key)
        out.push(m)
        if (out.length >= 4) break
      }
    }
    return out
  }, [name, history, editing])

  function applyTemplate(m: Meal) {
    setName(m.name)
    setLocation(m.storage_location)
    setMealType(m.meal_type)
    setShelfLife(lifeFromDays(m.shelf_life_days, m.storage_location))
    setLifeTouched(true)
    setServings(String(m.servings_per_pack))
    setPacks(String(m.initial_pack_quantity))
    setNotes(m.notes ?? '')
    setNums(toFormNums(m))
    setNutrientsExpanded(EXTENDED_NUTRIENTS.some((n) => m[n.key] != null))
    setShowSuggestions(false)
  }

  function setNum(key: NumField, v: string) {
    setNums((s) => ({ ...s, [key]: v }))
  }

  function numOrNull(key: NumField): number | null {
    const raw = nums[key]
    if (raw == null || raw.trim() === '') return null
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : null
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const packQty = Math.max(parseInt(packs) || 0, 0)
    const values: MealInsert = {
      name: name.trim(),
      prep_date: prepDate,
      shelf_life_days: shelfDays || 1,
      storage_location: location,
      meal_type: mealType,
      servings_per_pack: parseFloat(servings) || 1,
      pack_quantity: packQty,
      initial_pack_quantity: editing
        ? Math.max(editing.initial_pack_quantity, packQty)
        : packQty,
      recipe_id: base?.recipe_id ?? null,
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
    }
    onSave(values, editing?.id)
  }

  const inputCls =
    'rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60 w-full'
  const labelCls = 'text-[13px] font-medium text-ink2'

  return (
    <Sheet
      onClose={onClose}
      ariaLabel={editing ? 'Edit meal' : 'New meal'}
      panelClassName="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
      <form onSubmit={submit} className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" onClick={close} className="pressable text-[16px] text-tint">
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold">{editing ? 'Edit meal' : 'New meal'}</h2>
          <button
            type="submit"
            disabled={!name.trim()}
            className="pressable text-[16px] font-semibold text-tint disabled:opacity-40"
          >
            {editing ? 'Save' : 'Add'}
          </button>
        </div>

        <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-8 safe-b">
          <div className="relative flex flex-col gap-1.5">
            <span className={labelCls}>Name</span>
            <input
              className={inputCls}
              value={name}
              required
              data-autofocus={!editing || undefined}
              placeholder="e.g. Chicken burrito bowls"
              onChange={(e) => {
                setName(e.target.value)
                setShowSuggestions(true)
              }}
              onBlur={() => setShowSuggestions(false)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="fade-in absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl bg-elevated float-shadow"
                // keep the input focused so onBlur doesn't race the tap
                onPointerDown={(e) => e.preventDefault()}
              >
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applyTemplate(m)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[15px] transition-colors hover:bg-card2"
                  >
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="ml-2 shrink-0 text-[12px] text-ink2">
                      {m.calories != null ? `${m.calories} kcal` : 'reuse'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Storage</span>
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

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Type</span>
            <div className="flex rounded-xl bg-card2 p-0.5">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMealType(t.key)}
                  className={`pressable flex-1 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                    mealType === t.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Prep date</span>
              <input
                type="date"
                className={inputCls}
                value={prepDate}
                required
                onChange={(e) => setPrepDate(e.target.value)}
              />
            </label>
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
          </div>

          {bestBefore && (
            <div className="fade-in flex items-center justify-between rounded-xl bg-card2 px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-ink2">Best before</span>
              <span className="text-[15px] font-semibold">
                {fmtDateFull(format(bestBefore, 'yyyy-MM-dd'))}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Packs</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className={inputCls}
                value={packs}
                required
                onChange={(e) => setPacks(e.target.value)}
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

          <NutrientFields
            key={nutrientsExpanded ? 'expanded' : 'collapsed'}
            nums={nums}
            onChange={setNum}
            initiallyExpanded={nutrientsExpanded}
          />

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Notes</span>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={notes}
              placeholder="Freezer shelf, reheat instructions…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </form>
      )}
    </Sheet>
  )
}
