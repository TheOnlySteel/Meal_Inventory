import { useEffect, useState } from 'react'
import type { Meal } from '../lib/types'
import { MEAL_TYPES, STORAGE_LOCATIONS } from '../lib/types'
import { freshnessOf } from '../lib/freshness'
import { fmtDate, fmtNum } from '../lib/format'
import FreshnessRing from './FreshnessRing'
import MacroGrid from './MacroGrid'
import Icon from './Icon'

interface Props {
  meal: Meal
  expanded: boolean
  onToggle: () => void
  onEat: (packs: number) => void
  onAddPack: () => void
  onEdit: () => void
  onReprep: () => void
  onArchive: () => void
  onRestore?: () => void
  onDelete?: () => void
  onSaveAsRecipe?: () => void
}

/** Expandable meal card: summary row → tap → macro layer + actions. */
export default function MealCard({
  meal,
  expanded,
  onToggle,
  onEat,
  onAddPack,
  onEdit,
  onReprep,
  onArchive,
  onRestore,
  onDelete,
  onSaveAsRecipe,
}: Props) {
  const [eatCount, setEatCount] = useState(1)
  useEffect(() => {
    setEatCount(1)
  }, [expanded])
  const fresh = freshnessOf(meal)
  const depleted = meal.archived_at != null
  const packsPct =
    meal.initial_pack_quantity > 0 ? meal.pack_quantity / meal.initial_pack_quantity : 0
  const location = STORAGE_LOCATIONS.find((l) => l.key === meal.storage_location)
  const typeLabel = MEAL_TYPES.find((t) => t.key === meal.meal_type)?.label

  return (
    <div
      className={`pop-in rounded-2xl bg-card card-shadow transition-all ${
        depleted ? 'opacity-60' : ''
      }`}
      style={{ borderLeft: `4px solid ${depleted ? 'var(--ink-3)' : fresh.color}` }}
    >
      {/* The disclosure is a real button; action buttons below are siblings,
          not descendants, so the semantics stay valid. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <FreshnessRing freshness={fresh} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[17px] leading-tight font-semibold">{meal.name}</h3>
          </div>
          <p className="mt-0.5 text-[13px] text-ink2">
            {depleted ? (
              'Depleted'
            ) : (
              <span style={{ color: fresh.key !== 'fresh' ? fresh.textColor : undefined }}>
                {fresh.label}
              </span>
            )}
            <span className="text-ink3"> · </span>
            {location ? (
              <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                <Icon name={location.icon} size={12} className="self-center" />
                {location.label}
              </span>
            ) : null}
            <span className="text-ink3"> · </span>
            {fmtDate(meal.prep_date)} → {fmtDate(meal.best_before)}
            {meal.meal_type !== 'meal' && typeLabel ? (
              <>
                <span className="text-ink3"> · </span>
                {typeLabel}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-card2 px-2.5 py-1 text-[13px] font-semibold tabular-nums">
            {meal.pack_quantity}
            <span className="font-normal text-ink2"> / {meal.initial_pack_quantity}</span>
          </span>
          <span className="text-[11px] text-ink2">
            {fmtNum(meal.servings_per_pack)} serv/pack
          </span>
        </div>
      </button>

      {/* pack progress hairline */}
      <div className="mx-4 h-[3px] overflow-hidden rounded-full bg-card2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(packsPct * 100, 2)}%`,
            background: depleted ? 'var(--ink-3)' : fresh.color,
          }}
        />
      </div>

      {expanded && (
        <div className="fade-in flex flex-col gap-4 p-4">
          <MacroGrid meal={meal} />
          {meal.notes && <p className="text-[13px] whitespace-pre-wrap text-ink2">{meal.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {!depleted && meal.pack_quantity > 0 && (
              <div className="flex min-w-0 flex-1 items-stretch gap-2">
                {meal.pack_quantity > 1 && (
                  <div className="flex shrink-0 items-center rounded-xl bg-card2">
                    <button
                      onClick={() => setEatCount((n) => Math.max(n - 1, 1))}
                      aria-label="Eat fewer packs"
                      className="pressable px-3 py-2.5 text-[17px] font-semibold text-tint"
                    >
                      −
                    </button>
                    <span className="min-w-5 text-center text-[15px] font-semibold tabular-nums">
                      {eatCount}
                    </span>
                    <button
                      onClick={() => setEatCount((n) => Math.min(n + 1, meal.pack_quantity))}
                      aria-label="Eat more packs"
                      className="pressable px-3 py-2.5 text-[17px] font-semibold text-tint"
                    >
                      +
                    </button>
                  </div>
                )}
                <button
                  onClick={() => onEat(eatCount)}
                  className="pressable flex-1 rounded-xl bg-tint py-2.5 text-[15px] font-semibold text-white"
                >
                  Eat {eatCount === 1 ? 'one' : eatCount}
                </button>
              </div>
            )}
            {depleted && onRestore && (
              <button
                onClick={onRestore}
                className="pressable flex-1 rounded-xl bg-tint py-2.5 text-[15px] font-semibold text-white"
              >
                Restore
              </button>
            )}
            <button
              onClick={onAddPack}
              className="pressable rounded-xl bg-card2 px-4 py-2.5 text-[15px] font-semibold text-tint"
            >
              +1 pack
            </button>
            <button
              onClick={onReprep}
              className="pressable flex-1 rounded-xl bg-card2 py-2.5 text-[15px] font-semibold text-tint"
            >
              Re-prep
            </button>
            <button
              onClick={onEdit}
              className="pressable flex-1 rounded-xl bg-card2 py-2.5 text-[15px] font-semibold"
            >
              Edit
            </button>
            {onSaveAsRecipe && meal.recipe_id == null && (
              <button
                onClick={onSaveAsRecipe}
                className="pressable rounded-xl bg-card2 px-4 py-2.5 text-[15px] font-semibold text-tint"
              >
                Save as recipe
              </button>
            )}
            {!depleted ? (
              <button
                onClick={onArchive}
                className="pressable rounded-xl bg-card2 px-4 py-2.5 text-[15px] font-semibold text-ink2"
              >
                Archive
              </button>
            ) : (
              onDelete && (
                <button
                  onClick={onDelete}
                  className="pressable rounded-xl bg-card2 px-4 py-2.5 text-[15px] font-semibold"
                  style={{ color: 'var(--red)' }}
                >
                  Delete
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
