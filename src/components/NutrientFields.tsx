import { useState } from 'react'
import type { NutrientValues } from '../lib/types'
import { CORE_NUTRIENTS, EXTENDED_NUTRIENTS } from '../lib/types'

interface Props {
  /** Field values as strings (form state), keyed by nutrient key. */
  nums: Record<string, string>
  onChange: (key: keyof NutrientValues, value: string) => void
  initiallyExpanded?: boolean
}

const inputCls =
  'rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60 w-full'

/** Per-serving nutrition inputs: core grid + extended disclosure. */
export default function NutrientFields({ nums, onChange, initiallyExpanded = false }: Props) {
  const [showExtended, setShowExtended] = useState(initiallyExpanded)

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink2">Nutrition per serving</span>
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
                onChange={(e) => onChange(n.key, e.target.value)}
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
                onChange={(e) => onChange(n.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
    </>
  )
}
