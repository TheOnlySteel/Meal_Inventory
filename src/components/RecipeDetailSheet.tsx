import { useMemo, useState } from 'react'
import type { Recipe, StorageLocation } from '../lib/types'
import { STORAGE_LOCATIONS } from '../lib/types'
import { ingredientLines } from '../hooks/useRecipes'
import { scaleIngredientLine } from '../lib/groceries'
import { recipePhotoUrl } from '../lib/photos'
import { fmtNum } from '../lib/format'
import MacroGrid from './MacroGrid'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  recipe: Recipe
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onSendToLarder: (location: StorageLocation) => void
  /** Receives the (scaled) ingredient lines currently shown. */
  onIngredientsToShopping: (lines: string[]) => void
}

const SCALES = [
  { factor: 0.5, label: '½×' },
  { factor: 1, label: '1×' },
  { factor: 2, label: '2×' },
  { factor: 3, label: '3×' },
]

/** Recipe detail: read the recipe, scale it, then send the cooked batch to the larder. */
export default function RecipeDetailSheet({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onSendToLarder,
  onIngredientsToShopping,
}: Props) {
  const [scale, setScale] = useState(1)
  const lines = useMemo(
    () => ingredientLines(recipe).map((l) => scaleIngredientLine(l, scale)),
    [recipe, scale],
  )
  const photo = recipePhotoUrl(recipe.photo_path)
  const defaultFirst = [...STORAGE_LOCATIONS].sort((a, b) =>
    a.key === recipe.default_storage_location ? -1 : b.key === recipe.default_storage_location ? 1 : 0,
  )

  return (
    <Sheet
      onClose={onClose}
      ariaLabel={recipe.name}
      panelClassName="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={close} className="pressable text-[16px] text-tint">
            Close
          </button>
          <div className="flex items-center gap-4">
            <button onClick={onEdit} className="pressable text-[15px] font-semibold text-tint">
              Edit
            </button>
            <button
              onClick={onDelete}
              className="pressable text-[15px] font-semibold"
              style={{ color: 'var(--red)' }}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex flex-col gap-5 overflow-y-auto px-5 pt-1 pb-8 safe-b">
          {photo && (
            <img
              src={photo}
              alt=""
              className="aspect-[16/9] w-full rounded-2xl object-cover card-shadow"
            />
          )}

          <div>
            <h2 className="text-[26px] leading-tight font-bold tracking-tight">{recipe.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-ink2">
              <Icon
                name={
                  STORAGE_LOCATIONS.find((l) => l.key === recipe.default_storage_location)!.icon
                }
                size={13}
              />
              Usually {recipe.default_storage_location} · {recipe.default_shelf_life_days} day
              {recipe.default_shelf_life_days === 1 ? '' : 's'} shelf life
            </p>
            {recipe.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recipe.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-card2 px-2.5 py-1 text-[12px] font-semibold text-ink2"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                  Ingredients
                </h3>
                <button
                  onClick={() => onIngredientsToShopping(lines)}
                  className="pressable rounded-full bg-card2 px-3 py-1 text-[12px] font-semibold text-tint"
                >
                  + Shopping list
                </button>
              </div>

              {/* Batch scaler: quantities below (and the shopping send) follow it */}
              <div className="flex items-center justify-between">
                <div className="flex rounded-lg bg-card2 p-0.5">
                  {SCALES.map((s) => (
                    <button
                      key={s.factor}
                      onClick={() => setScale(s.factor)}
                      aria-pressed={scale === s.factor}
                      className={`pressable rounded-md px-3 py-1 text-[13px] font-semibold transition-colors ${
                        scale === s.factor ? 'bg-card text-ink card-shadow' : 'text-ink2'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] font-medium text-ink2">
                  {fmtNum(Number(recipe.servings_per_pack) * scale)} serv/pack
                </span>
              </div>

              <ul className="flex flex-col gap-1 rounded-2xl bg-card2 px-4 py-3">
                {lines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[15px]">
                    <span className="text-ink3">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recipe.instructions.trim() && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                Instructions
              </h3>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {recipe.instructions}
              </p>
            </section>
          )}

          <MacroGrid meal={recipe} />

          {recipe.notes && (
            <p className="text-[14px] whitespace-pre-wrap text-ink2">{recipe.notes}</p>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
              Made a batch? Send it to…
            </h3>
            <div className="flex gap-2">
              {defaultFirst.map((l) => (
                <button
                  key={l.key}
                  onClick={() => onSendToLarder(l.key)}
                  className={`pressable flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[15px] font-semibold ${
                    l.key === recipe.default_storage_location
                      ? 'bg-tint text-white'
                      : 'bg-card2 text-tint'
                  }`}
                >
                  <Icon name={l.icon} size={16} /> {l.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      )}
    </Sheet>
  )
}
