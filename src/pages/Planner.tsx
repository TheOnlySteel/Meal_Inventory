import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, isSameDay, isToday, parseISO } from 'date-fns'
import { usePlan, usePlanMutations, planRange } from '../hooks/usePlanner'
import { useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import { freshnessOf } from '../lib/freshness'
import { fmtNum } from '../lib/format'
import type { PlanEntry, PlanSlot } from '../lib/types'
import { PLAN_SLOTS } from '../lib/types'
import PlanEntrySheet from '../components/PlanEntrySheet'

export default function Planner() {
  const { data: entries, isLoading, error } = usePlan()
  const { completeEntry, uncompleteEntry, deleteEntry } = usePlanMutations()
  const { addItem } = useShoppingMutations()
  const { toast } = useToast()
  const [selected, setSelected] = useState(() => new Date())
  const [sheet, setSheet] = useState<{ date: Date; slot: PlanSlot } | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const { start } = planRange()
    return Array.from({ length: 15 }, (_, i) => addDays(start, i))
  }, [])

  const byDay = useMemo(() => {
    const map = new Map<string, PlanEntry[]>()
    for (const e of entries ?? []) {
      const list = map.get(e.plan_date) ?? []
      list.push(e)
      map.set(e.plan_date, list)
    }
    return map
  }, [entries])

  const dayEntries = byDay.get(format(selected, 'yyyy-MM-dd')) ?? []

  const toMake = useMemo(
    () =>
      (entries ?? []).filter((e) => e.meal_id == null && e.title && e.completed_at == null),
    [entries],
  )

  // Center today's pill on first render
  useEffect(() => {
    stripRef.current
      ?.querySelector('[data-today="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  function displayName(e: PlanEntry) {
    return e.meals?.name ?? e.title ?? 'Untitled'
  }

  function onComplete(entry: PlanEntry) {
    completeEntry.mutate(entry, {
      onSuccess: () => {
        toast(entry.meal_id ? `Ate 1 · ${displayName(entry)}` : `Done · ${displayName(entry)}`, {
          undo: () => uncompleteEntry.mutate(entry.id),
        })
      },
      onError: () => toast('Could not update', { tone: 'error' }),
    })
  }

  function onSendToShopping(entry: PlanEntry) {
    addItem.mutate(displayName(entry), {
      onSuccess: () => toast(`Added ${displayName(entry)} to shopping`),
      onError: () => toast('Could not add', { tone: 'error' }),
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="px-4 pt-3 pb-1">
          <h1 className="text-[28px] font-bold tracking-tight">Planner</h1>
        </div>
        {/* Day strip */}
        <div ref={stripRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pt-1 pb-3">
          {days.map((day) => {
            const iso = format(day, 'yyyy-MM-dd')
            const active = isSameDay(day, selected)
            const today = isToday(day)
            const dayList = byDay.get(iso) ?? []
            const hasOpen = dayList.some((e) => e.completed_at == null)
            return (
              <button
                key={iso}
                data-today={today}
                onClick={() => setSelected(day)}
                className={`pressable flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                  active ? 'bg-tint text-white' : 'bg-card2 text-ink'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    active ? 'text-white/80' : today ? 'text-tint' : 'text-ink2'
                  }`}
                >
                  {today ? 'Today' : format(day, 'EEE')}
                </span>
                <span className="text-[17px] leading-none font-bold tabular-nums">
                  {format(day, 'd')}
                </span>
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    background: hasOpen ? (active ? 'white' : 'var(--tint)') : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-28">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load the plan. Check connection.
          </p>
        )}

        {!isLoading &&
          !error &&
          PLAN_SLOTS.map((slot) => {
            const slotEntries = dayEntries.filter((e) => e.slot === slot.key)
            return (
              <section key={slot.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                    {slot.icon} {slot.label}
                  </h2>
                  <button
                    onClick={() => setSheet({ date: selected, slot: slot.key })}
                    className="pressable text-[13px] font-semibold text-tint"
                  >
                    + Add
                  </button>
                </div>

                {slotEntries.length === 0 ? (
                  <button
                    onClick={() => setSheet({ date: selected, slot: slot.key })}
                    className="rounded-2xl border border-dashed border-sep py-3 text-[13px] text-ink3"
                  >
                    Nothing planned
                  </button>
                ) : (
                  slotEntries.map((entry) => {
                    const done = entry.completed_at != null
                    const meal = entry.meals
                    const fresh = meal && meal.archived_at == null ? freshnessOf(meal) : null
                    return (
                      <div
                        key={entry.id}
                        className={`pop-in flex items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow ${
                          done ? 'opacity-60' : ''
                        }`}
                      >
                        <button
                          onClick={() =>
                            done ? uncompleteEntry.mutate(entry.id) : onComplete(entry)
                          }
                          aria-label={done ? 'Mark not done' : 'Mark done'}
                          className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                          style={{
                            borderColor: done ? 'var(--green)' : 'var(--sep)',
                            background: done ? 'var(--green)' : 'transparent',
                          }}
                        >
                          {done && (
                            <svg width="14" height="14" viewBox="0 0 24 24">
                              <path
                                d="M5 12.5 10 17.5 19 7"
                                fill="none"
                                stroke="white"
                                strokeWidth="3.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[16px] font-semibold ${done ? 'line-through' : ''}`}
                          >
                            {displayName(entry)}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink2">
                            {meal ? (
                              <>
                                {fresh && (
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ background: fresh.color }}
                                  />
                                )}
                                <span>
                                  {meal.pack_quantity} pack{meal.pack_quantity === 1 ? '' : 's'} left
                                  {entry.servings !== 1 ? ` · ${fmtNum(entry.servings)} serv` : ''}
                                </span>
                              </>
                            ) : (
                              <span className="rounded-full bg-card2 px-2 py-0.5 font-semibold text-tint">
                                to make
                              </span>
                            )}
                            {entry.notes ? <span className="truncate">· {entry.notes}</span> : null}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteEntry.mutate(entry.id)}
                          aria-label="Remove from plan"
                          className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path
                              d="M6 6l12 12M18 6L6 18"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    )
                  })
                )}
              </section>
            )
          })}

        {/* To-make roundup across the whole strip */}
        {toMake.length > 0 && (
          <section className="mt-2 flex flex-col gap-2 rounded-2xl bg-card p-4 card-shadow">
            <h2 className="text-[13px] font-semibold tracking-wide text-ink2 uppercase">
              👩‍🍳 To make
            </h2>
            {toMake.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{entry.title}</p>
                  <p className="text-[12px] text-ink2">
                    {format(parseISO(entry.plan_date), 'EEE, MMM d')} ·{' '}
                    {PLAN_SLOTS.find((s) => s.key === entry.slot)?.label}
                  </p>
                </div>
                <button
                  onClick={() => onSendToShopping(entry)}
                  className="pressable shrink-0 rounded-full bg-card2 px-3 py-1.5 text-[12px] font-semibold text-tint"
                >
                  + Shopping
                </button>
              </div>
            ))}
          </section>
        )}
      </main>

      {sheet && (
        <PlanEntrySheet
          date={sheet.date}
          slot={sheet.slot}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
