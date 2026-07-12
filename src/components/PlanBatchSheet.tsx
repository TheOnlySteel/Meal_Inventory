import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { usePlanMutations } from '../hooks/usePlanner'
import { useToast } from '../hooks/useToast'
import { useToday } from '../hooks/useToday'
import type { Meal, PlanSlot } from '../lib/types'
import { PLAN_SLOTS } from '../lib/types'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  meal: Meal
  onClose: () => void
}

/** Cook once, eat many: spread one batch across upcoming days in one go. */
export default function PlanBatchSheet({ meal, onClose }: Props) {
  const { addEntries } = usePlanMutations()
  const { toast } = useToast()
  const todayIso = useToday()
  const [slot, setSlot] = useState<PlanSlot>('dinner')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(parseISO(todayIso), i)),
    [todayIso],
  )

  function toggle(iso: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  async function save(close: () => void) {
    if (saving || picked.size === 0) return
    setSaving(true)
    try {
      await addEntries.mutateAsync(
        [...picked].sort().map((iso) => ({ plan_date: iso, slot, meal_id: meal.id })),
      )
      toast(`Planned ${picked.size} day${picked.size === 1 ? '' : 's'} of ${meal.name}`)
      close()
    } catch {
      toast('Could not save — check your connection', { tone: 'error' })
      setSaving(false)
    }
  }

  const overbooked = picked.size > meal.pack_quantity

  return (
    <Sheet
      onClose={onClose}
      ariaLabel={`Plan ${meal.name}`}
      panelClassName="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <button onClick={close} className="pressable text-[16px] text-tint">
              Cancel
            </button>
            <h2 className="max-w-[55%] truncate text-[16px] font-semibold">{meal.name}</h2>
            <button
              onClick={() => save(close)}
              disabled={picked.size === 0 || saving}
              className="pressable text-[16px] font-semibold text-tint disabled:opacity-40"
            >
              {saving ? 'Adding…' : picked.size > 0 ? `Add ${picked.size}` : 'Add'}
            </button>
          </div>
          <p className="px-5 pb-2 text-[13px] text-ink2">
            {meal.pack_quantity} pack{meal.pack_quantity === 1 ? '' : 's'} in storage — pick the
            days to eat it.
            {overbooked && (
              <span style={{ color: 'var(--orange)' }}> Planning more days than packs.</span>
            )}
          </p>

          <div className="mx-5 mb-3 flex rounded-xl bg-card2 p-0.5">
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

          <div className="no-scrollbar grid min-h-0 grid-cols-2 gap-2 overflow-y-auto px-5 pb-8 safe-b">
            {days.map((day) => {
              const iso = format(day, 'yyyy-MM-dd')
              const active = picked.has(iso)
              const isToday = iso === todayIso
              return (
                <button
                  key={iso}
                  onClick={() => toggle(iso)}
                  aria-pressed={active}
                  className={`pressable rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                    active ? 'bg-tint text-white' : 'bg-card2 text-ink'
                  }`}
                >
                  {isToday ? 'Today' : format(day, 'EEE, MMM d')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Sheet>
  )
}
