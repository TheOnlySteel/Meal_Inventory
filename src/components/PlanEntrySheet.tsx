import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useMeals } from '../hooks/useMeals'
import { usePlanMutations } from '../hooks/usePlanner'
import { useToast } from '../hooks/useToast'
import { freshnessOf } from '../lib/freshness'
import type { PlanSlot } from '../lib/types'
import { PLAN_SLOTS, STORAGE_LOCATIONS } from '../lib/types'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  date: Date
  initialSlot?: PlanSlot
  onClose: () => void
}

/** Add a plan entry: pick a meal from the larder, or note something to make. */
export default function PlanEntrySheet({ date, initialSlot, onClose }: Props) {
  const { data: meals } = useMeals()
  const { addEntry } = usePlanMutations()
  const { toast } = useToast()
  const [mode, setMode] = useState<'larder' | 'tomake'>('larder')
  const [slot, setSlot] = useState<PlanSlot>(initialSlot ?? 'dinner')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const candidates = useMemo(() => {
    const active = (meals ?? []).filter((m) => m.archived_at == null && m.pack_quantity > 0)
    const q = search.trim().toLowerCase()
    return q ? active.filter((m) => m.name.toLowerCase().includes(q)) : active
  }, [meals, search])

  function save(entry: { meal_id?: string; title?: string }, close: () => void) {
    addEntry.mutate(
      {
        plan_date: format(date, 'yyyy-MM-dd'),
        slot,
        notes: notes.trim() || null,
        ...entry,
      },
      {
        onError: () => toast('Could not save', { tone: 'error' }),
      },
    )
    close()
  }

  return (
    <Sheet
      onClose={onClose}
      ariaLabel="Plan something"
      panelClassName="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={close} className="pressable text-[16px] text-tint">
            Cancel
          </button>
          <h2 className="text-[16px] font-semibold">{format(date, 'EEE, MMM d')}</h2>
          <span className="w-12" />
        </div>

        <div className="mx-5 mb-2 flex rounded-xl bg-card2 p-0.5">
          {PLAN_SLOTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSlot(s.key)}
              className={`pressable flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors ${
                slot === s.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
              }`}
            >
              <Icon name={s.icon} size={14} /> {s.label}
            </button>
          ))}
        </div>

        <div className="mx-5 mb-3 flex rounded-xl bg-card2 p-0.5">
          {(
            [
              { key: 'larder' as const, label: 'From larder' },
              { key: 'tomake' as const, label: 'To make' },
            ]
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`pressable flex-1 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                mode === m.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'larder' ? (
          <div className="flex min-h-0 flex-col gap-2 px-5 pb-6 safe-b">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the larder"
              className="w-full shrink-0 rounded-xl bg-card2 px-4 py-2 text-[16px] outline-none placeholder:text-ink3 focus:ring-2 focus:ring-tint/50"
            />
            <div className="no-scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto pb-2">
              {candidates.length === 0 && (
                <p className="py-8 text-center text-[14px] text-ink2">
                  {search ? 'No meals match' : 'No meals with packs left — add one in the Larder tab'}
                </p>
              )}
              {candidates.map((meal) => {
                const fresh = freshnessOf(meal)
                const loc = STORAGE_LOCATIONS.find((l) => l.key === meal.storage_location)
                return (
                  <button
                    key={meal.id}
                    onClick={() => save({ meal_id: meal.id }, close)}
                    className="pressable flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left card-shadow"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: fresh.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{meal.name}</span>
                      <span className="flex items-center gap-1 text-[12px] text-ink2">
                        {loc ? <Icon name={loc.icon} size={12} /> : null}
                        {loc?.label} · {meal.pack_quantity} pack
                        {meal.pack_quantity === 1 ? '' : 's'} · {fresh.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-tint">Add</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) save({ title: title.trim() }, close)
            }}
            className="flex flex-col gap-3 px-5 pb-8 safe-b"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink2">What are you making?</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lasagna from scratch"
                className="rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-tint/60"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink2">Notes</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional — recipe link, reminders…"
                className="resize-none rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-tint/60"
              />
            </label>
            <button
              type="submit"
              disabled={!title.trim()}
              className="pressable rounded-xl bg-tint py-3 text-[16px] font-semibold text-white disabled:opacity-40"
            >
              Add to plan
            </button>
          </form>
        )}
      </div>
      )}
    </Sheet>
  )
}
