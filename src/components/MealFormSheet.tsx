import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import type { Meal, MealInsert, NutrientDef } from '../lib/types'
import { CORE_NUTRIENTS, EXTENDED_NUTRIENTS } from '../lib/types'
import { fmtDateFull, todayISO } from '../lib/format'

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
  const [shelfWeeks, setShelfWeeks] = useState(String(base?.shelf_life_weeks ?? 12))
  const [servings, setServings] = useState(String(base?.servings_per_pack ?? 1))
  const [packs, setPacks] = useState(String(editing?.pack_quantity ?? base?.initial_pack_quantity ?? 4))
  const [notes, setNotes] = useState(base?.notes ?? '')
  const [nums, setNums] = useState<Record<string, string>>(toFormNums(base))
  const [showExtended, setShowExtended] = useState(
    EXTENDED_NUTRIENTS.some((n) => base?.[n.key] != null),
  )
  const [showSuggestions, setShowSuggestions] = useState(false)

  const bestBefore = useMemo(() => {
    const weeks = parseFloat(shelfWeeks)
    if (!prepDate || !weeks || weeks <= 0) return null
    return addDays(parseISO(prepDate), Math.round(weeks * 7))
  }, [prepDate, shelfWeeks])

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
    setShelfWeeks(String(m.shelf_life_weeks))
    setServings(String(m.servings_per_pack))
    setPacks(String(m.initial_pack_quantity))
    setNotes(m.notes ?? '')
    setNums(toFormNums(m))
    setShowExtended(EXTENDED_NUTRIENTS.some((n) => m[n.key] != null))
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
      shelf_life_weeks: parseFloat(shelfWeeks) || 1,
      servings_per_pack: parseFloat(servings) || 1,
      pack_quantity: packQty,
      initial_pack_quantity: editing
        ? Math.max(editing.initial_pack_quantity, packQty)
        : packQty,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={submit}
        className="sheet-up relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" onClick={onClose} className="pressable text-[16px] text-tint">
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
              autoFocus={!editing}
              placeholder="e.g. Chicken burrito bowls"
              onChange={(e) => {
                setName(e.target.value)
                setShowSuggestions(true)
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="fade-in absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl bg-elevated float-shadow">
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={() => applyTemplate(m)}
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
              <span className={labelCls}>Shelf life (weeks)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0.5"
                className={inputCls}
                value={shelfWeeks}
                required
                onChange={(e) => setShelfWeeks(e.target.value)}
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

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Nutrition per serving</span>
            <div className="grid grid-cols-2 gap-3">
              {CORE_NUTRIENTS.map((n) => (
                <label key={n.key} className="flex flex-col gap-1">
                  <span className="text-[12px] text-ink2">
                    {n.label} ({n.unit})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    className={inputCls}
                    value={nums[n.key] ?? ''}
                    onChange={(e) => setNum(n.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowExtended((s) => !s)}
            className="pressable flex items-center gap-1 self-start text-[14px] font-semibold text-tint"
          >
            {showExtended ? 'Hide extended nutrition' : 'Extended nutrition'}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className={`transition-transform ${showExtended ? 'rotate-180' : ''}`}
            >
              <path
                d="M2 4.5 6 8.5 10 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {showExtended && (
            <div className="fade-in grid grid-cols-2 gap-3 sm:grid-cols-3">
              {EXTENDED_NUTRIENTS.map((n) => (
                <label key={n.key} className="flex flex-col gap-1">
                  <span className="text-[12px] text-ink2">
                    {n.label} ({n.unit})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    className={inputCls}
                    value={nums[n.key] ?? ''}
                    onChange={(e) => setNum(n.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          )}

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
    </div>
  )
}
