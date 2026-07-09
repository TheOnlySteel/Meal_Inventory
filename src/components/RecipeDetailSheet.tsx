import type { Recipe, StorageLocation } from '../lib/types'
import { STORAGE_LOCATIONS } from '../lib/types'
import { ingredientLines } from '../hooks/useRecipes'
import MacroGrid from './MacroGrid'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  recipe: Recipe
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onSendToLarder: (location: StorageLocation) => void
  onIngredientsToShopping: () => void
}

/** Recipe detail: read the recipe, then send the cooked batch to the larder. */
export default function RecipeDetailSheet({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onSendToLarder,
  onIngredientsToShopping,
}: Props) {
  const lines = ingredientLines(recipe)
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
          </div>

          {lines.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                  Ingredients
                </h3>
                <button
                  onClick={onIngredientsToShopping}
                  className="pressable rounded-full bg-card2 px-3 py-1 text-[12px] font-semibold text-tint"
                >
                  + Shopping list
                </button>
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
