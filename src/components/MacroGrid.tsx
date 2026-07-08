import { useState } from 'react'
import type { Meal } from '../lib/types'
import { CORE_NUTRIENTS, EXTENDED_NUTRIENTS } from '../lib/types'
import { fmtNum } from '../lib/format'

/** Macro layer: per-serving / per-pack toggle, extended nutrients behind a disclosure. */
export default function MacroGrid({ meal, large = false }: { meal: Meal; large?: boolean }) {
  const [perPack, setPerPack] = useState(false)
  const [showExtended, setShowExtended] = useState(false)
  const mult = perPack ? Number(meal.servings_per_pack) : 1

  const hasExtended = EXTENDED_NUTRIENTS.some((n) => meal[n.key] != null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink2">Nutrition</span>
        <div className="flex rounded-lg bg-card2 p-0.5 text-[12px] font-semibold">
          {(['serving', 'pack'] as const).map((mode) => (
            <button
              key={mode}
              onClick={(e) => {
                e.stopPropagation()
                setPerPack(mode === 'pack')
              }}
              className={`pressable rounded-md px-2.5 py-1 capitalize transition-colors ${
                perPack === (mode === 'pack') ? 'bg-card text-ink card-shadow' : 'text-ink2'
              }`}
            >
              per {mode}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-4 ${large ? 'gap-3' : 'gap-2'}`}>
        {CORE_NUTRIENTS.map((n) => {
          const v = meal[n.key] as number | null
          return (
            <div
              key={n.key}
              className="flex flex-col items-center rounded-xl bg-card2 px-1 py-2.5"
            >
              <span
                className={`font-bold tabular-nums ${large ? 'text-[22px]' : 'text-[17px]'}`}
              >
                {v == null ? '—' : fmtNum(v * mult)}
              </span>
              <span className="text-[11px] font-medium text-ink2">
                {n.key === 'calories' ? 'kcal' : `${n.label} ${n.unit}`}
              </span>
            </div>
          )
        })}
      </div>

      {hasExtended && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowExtended((s) => !s)
            }}
            className="pressable flex items-center gap-1 self-start text-[13px] font-semibold text-tint"
          >
            {showExtended ? 'Less nutrition' : 'More nutrition'}
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
            <div className="fade-in grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {EXTENDED_NUTRIENTS.filter((n) => meal[n.key] != null).map((n) => (
                <div
                  key={n.key}
                  className="flex items-baseline justify-between border-b border-sep pb-1 text-[13px]"
                >
                  <span className="text-ink2">{n.label}</span>
                  <span className="font-semibold tabular-nums">
                    {fmtNum((meal[n.key] as number) * mult, 1)}
                    <span className="ml-0.5 text-[11px] font-normal text-ink2">{n.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
