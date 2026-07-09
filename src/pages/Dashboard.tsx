import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useMeals, useMealMutations, useRealtimeSync } from '../hooks/useMeals'
import { usePlan, usePlanMutations } from '../hooks/usePlanner'
import { useChores, useChoreMutations } from '../hooks/useChores'
import { useMembers, memberName } from '../hooks/useMembers'
import { useToast } from '../hooks/useToast'
import { useToday } from '../hooks/useToday'
import { freshnessOf } from '../lib/freshness'
import { groupChores, dueLabel } from '../lib/chores'
import { fmtDateFull, fmtNum } from '../lib/format'
import { pressableProps } from '../lib/a11y'
import type { Chore, Meal, PlanEntry } from '../lib/types'
import { PLAN_SLOTS, STORAGE_LOCATIONS } from '../lib/types'
import FreshnessRing from '../components/FreshnessRing'
import MacroGrid from '../components/MacroGrid'
import Sheet from '../components/Sheet'
import Icon from '../components/Icon'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 20)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Keep the iPad display awake while the dashboard is visible. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    async function acquire() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
        }
        if (nav.wakeLock && document.visibilityState === 'visible') {
          lock = await nav.wakeLock.request('screen')
        }
      } catch {
        /* not supported / denied — harmless */
      }
    }
    acquire()
    const onVis = () => acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}

export default function Dashboard() {
  useRealtimeSync()
  useWakeLock()
  const now = useClock()
  const todayIso = useToday()
  const { data: meals, isLoading } = useMeals()
  const { data: plan } = usePlan()
  const { data: chores } = useChores()
  const { data: members } = useMembers()
  const { eatPack, undoEat } = useMealMutations()
  const { completeEntry, uncompleteEntry } = usePlanMutations()
  const { completeChore, uncompleteChore } = useChoreMutations()
  const { toast } = useToast()
  const [detail, setDetail] = useState<Meal | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = useMemo(
    () => (meals ?? []).filter((m) => m.archived_at == null),
    [meals],
  )

  // Evaluated against the ticking date so the badge stays honest as days pass
  const stats = useMemo(() => {
    const today = parseISO(todayIso)
    const packs = active.reduce((s, m) => s + m.pack_quantity, 0)
    const urgent = active.filter((m) => {
      const k = freshnessOf(m, today).key
      return k === 'expired' || k === 'now'
    }).length
    return { meals: active.length, packs, urgent }
  }, [active, todayIso])

  // Auto-dismiss the drill-down after 30s idle so the kiosk returns to the grid
  useEffect(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    if (detail) dismissTimer.current = setTimeout(() => setDetail(null), 30_000)
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [detail])

  // Keep the detail overlay in sync with live data
  const liveDetail = detail ? (active.find((m) => m.id === detail.id) ?? null) : null

  const todayPlan = useMemo(() => {
    const iso = format(now, 'yyyy-MM-dd')
    const order = new Map(PLAN_SLOTS.map((s, i) => [s.key, i]))
    return (plan ?? [])
      .filter((e) => e.plan_date === iso)
      .sort((a, b) => (order.get(a.slot) ?? 0) - (order.get(b.slot) ?? 0))
  }, [plan, now])

  // Overdue + due-today chores, plus one-offs finished today (shown ticked)
  const todayChores = useMemo(() => {
    const g = groupChores(chores ?? [], todayIso)
    const doneToday = g.done.filter((c) => (c.completed_at ?? '').slice(0, 10) === todayIso)
    return [...g.overdue, ...g.today, ...doneToday]
  }, [chores, todayIso])

  function tickChore(chore: Chore) {
    if (chore.completed_at != null) {
      uncompleteChore.mutate(chore.id)
      return
    }
    completeChore.mutate(chore, {
      onSuccess: () =>
        toast(`Done · ${chore.title}`, { undo: () => uncompleteChore.mutate(chore.id) }),
      onError: () => toast('Could not update', { tone: 'error' }),
    })
  }

  function tickPlan(entry: PlanEntry) {
    if (entry.completed_at != null) {
      uncompleteEntry.mutate(entry.id)
      return
    }
    completeEntry.mutate(entry, {
      onSuccess: () => {
        const name = entry.meals?.name ?? entry.title ?? 'entry'
        toast(entry.meal_id ? `Ate 1 · ${name}` : `Done · ${name}`, {
          undo: () => uncompleteEntry.mutate(entry.id),
        })
      },
      onError: () => toast('Could not update', { tone: 'error' }),
    })
  }

  function tickOff(meal: Meal, e: React.MouseEvent) {
    e.stopPropagation()
    eatPack.mutate(meal, {
      onSuccess: ({ log_id, depleted }) => {
        toast(depleted ? `Last pack of ${meal.name}` : `Ate 1 · ${meal.name}`, {
          undo: () => undoEat.mutate(log_id),
        })
      },
      onError: () => toast('Could not update', { tone: 'error' }),
    })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas safe-t">
      {/* Header */}
      <header className="flex items-end justify-between px-8 pt-6 pb-4">
        <div>
          <h1 className="text-[44px] leading-none font-bold tracking-tight tabular-nums">
            {format(now, 'h:mm')}
            <span className="ml-1 text-[22px] font-semibold text-ink2">{format(now, 'a')}</span>
          </h1>
          <p className="mt-1 text-[17px] font-medium text-ink2">{format(now, 'EEEE, MMMM d')}</p>
        </div>
        <div className="flex items-center gap-6">
          <Stat value={stats.meals} label="meals" />
          <Stat value={stats.packs} label="packs" />
          {stats.urgent > 0 ? (
            <div
              className="breathe flex items-baseline gap-2 rounded-2xl px-4 py-2 text-white"
              style={{ background: 'var(--orange)' }}
            >
              <span className="text-[28px] font-bold tabular-nums">{stats.urgent}</span>
              <span className="text-[15px] font-medium">need eating</span>
            </div>
          ) : (
            <div
              className="flex items-baseline gap-2 rounded-2xl px-4 py-2"
              style={{ background: 'color-mix(in srgb, var(--green) 18%, transparent)' }}
            >
              <span className="text-[15px] font-semibold" style={{ color: 'var(--green)' }}>
                All fresh
              </span>
            </div>
          )}
          <Link to="/" className="pressable text-[13px] font-semibold text-ink3">
            Manage
          </Link>
        </div>
      </header>

      {/* Today's plan + chores strip */}
      {todayPlan.length + todayChores.length > 0 && (
        <div className="no-scrollbar flex shrink-0 gap-3 overflow-x-auto px-8 pb-4">
          {todayPlan.map((entry) => {
            const done = entry.completed_at != null
            const slotDef = PLAN_SLOTS.find((s) => s.key === entry.slot)
            return (
              <div
                key={entry.id}
                className={`pop-in flex shrink-0 items-center gap-3 rounded-2xl bg-card py-2.5 pr-2.5 pl-4 card-shadow ${
                  done ? 'opacity-55' : ''
                }`}
              >
                <div>
                  <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-ink2 uppercase">
                    {slotDef ? <Icon name={slotDef.icon} size={12} /> : null} {slotDef?.label}
                  </p>
                  <p className={`text-[15px] font-semibold ${done ? 'line-through' : ''}`}>
                    {entry.meals?.name ?? entry.title}
                  </p>
                </div>
                <button
                  onClick={() => tickPlan(entry)}
                  aria-label={done ? 'Mark not done' : 'Mark done'}
                  className="pressable hit flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    background: done ? 'var(--green)' : 'var(--card-2)',
                    color: done ? 'white' : 'var(--ink-2)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      d="M5 12.5 10 17.5 19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )
          })}

          {todayChores.map((chore) => {
            const done = chore.completed_at != null
            const overdue = !done && chore.due_date != null && chore.due_date < todayIso
            return (
              <div
                key={chore.id}
                className={`pop-in flex shrink-0 items-center gap-3 rounded-2xl bg-card py-2.5 pr-2.5 pl-4 card-shadow ${
                  done ? 'opacity-55' : ''
                }`}
              >
                <div>
                  <p
                    className="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase"
                    style={{ color: overdue ? 'var(--orange)' : 'var(--ink-2)' }}
                  >
                    <Icon name="checklist" size={12} />{' '}
                    {chore.assigned_to ? memberName(members, chore.assigned_to) : 'Anyone'}
                    {overdue ? ` · ${dueLabel(chore.due_date, todayIso)}` : ''}
                  </p>
                  <p className={`text-[15px] font-semibold ${done ? 'line-through' : ''}`}>
                    {chore.title}
                  </p>
                </div>
                <button
                  onClick={() => tickChore(chore)}
                  aria-label={done ? 'Mark not done' : 'Mark done'}
                  className="pressable hit flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                  style={{
                    background: done ? 'var(--green)' : 'var(--card-2)',
                    color: done ? 'white' : 'var(--ink-2)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      d="M5 12.5 10 17.5 19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Grid */}
      <main className="no-scrollbar grid flex-1 auto-rows-min grid-cols-3 gap-4 overflow-y-auto px-8 pb-8 lg:grid-cols-4">
        {isLoading &&
          [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-40" />)}

        {!isLoading && active.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-24">
            <Icon name="takeout" size={72} strokeWidth={1} className="text-ink3" />
            <p className="text-[22px] font-semibold text-ink2">The larder is empty</p>
          </div>
        )}

        {active.map((meal) => {
          const fresh = freshnessOf(meal)
          return (
            <div
              key={meal.id}
              onClick={() => setDetail(meal)}
              {...pressableProps(() => setDetail(meal))}
              className="pop-in pressable relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl bg-card p-5 text-left card-shadow"
              style={{ borderTop: `4px solid ${fresh.color}` }}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[19px] leading-snug font-semibold">{meal.name}</h3>
                  <p
                    className="mt-0.5 text-[14px] font-medium"
                    style={{ color: fresh.key === 'fresh' ? 'var(--ink-2)' : fresh.textColor }}
                  >
                    {fresh.label}
                    <span className="text-ink3"> · </span>
                    <span className="inline-flex items-center gap-1 text-ink2 whitespace-nowrap align-middle">
                      <Icon
                        name={STORAGE_LOCATIONS.find((l) => l.key === meal.storage_location)!.icon}
                        size={13}
                      />
                      {STORAGE_LOCATIONS.find((l) => l.key === meal.storage_location)?.label}
                    </span>
                  </p>
                </div>
                <FreshnessRing freshness={fresh} size={52} />
              </div>

              <div className="mt-4 flex w-full items-end justify-between">
                <div>
                  <p className="text-[28px] leading-none font-bold tabular-nums">
                    {meal.pack_quantity}
                    <span className="text-[15px] font-medium text-ink2">
                      {' '}
                      / {meal.initial_pack_quantity} packs
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink2">
                    {fmtNum(meal.servings_per_pack)} serv ·{' '}
                    {meal.calories != null ? `${fmtNum(meal.calories)} kcal` : 'no macros'}
                  </p>
                </div>
                {/* Tick off as taken */}
                <button
                  aria-label={`Mark one ${meal.name} as taken`}
                  onClick={(e) => tickOff(meal, e)}
                  className="pressable hit flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{ background: 'var(--tint)' }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path
                      d="M4.5 12.5 10 18 19.5 6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </main>

      {/* Drill-down overlay */}
      {liveDetail && (
        <Sheet
          onClose={() => setDetail(null)}
          variant="center"
          ariaLabel={liveDetail.name}
          panelClassName="mx-10 flex max-h-[90dvh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-3xl bg-elevated p-8 float-shadow"
        >
          {(close) => {
            const fresh = freshnessOf(liveDetail)
            return (
              <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[32px] leading-tight font-bold tracking-tight">
                        {liveDetail.name}
                      </h2>
                      <p
                        className="mt-1 text-[17px] font-semibold"
                        style={{ color: fresh.textColor }}
                      >
                        {fresh.label}
                      </p>
                    </div>
                    <FreshnessRing freshness={fresh} size={72} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <InfoTile label="Prepped" value={fmtDateFull(liveDetail.prep_date)} />
                    <InfoTile label="Best before" value={fmtDateFull(liveDetail.best_before)} />
                    <InfoTile
                      label="Remaining"
                      value={`${liveDetail.pack_quantity} of ${liveDetail.initial_pack_quantity} packs`}
                    />
                  </div>

                  <MacroGrid meal={liveDetail} large />

                  {liveDetail.notes && (
                    <p className="text-[15px] whitespace-pre-wrap text-ink2">{liveDetail.notes}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={(e) => tickOff(liveDetail, e)}
                      className="pressable flex-1 rounded-2xl bg-tint py-4 text-[17px] font-semibold text-white"
                    >
                      ✓&ensp;Take one pack
                    </button>
                    <button
                      onClick={close}
                      className="pressable rounded-2xl bg-card2 px-8 py-4 text-[17px] font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </>
              )
          }}
        </Sheet>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[28px] font-bold tabular-nums">{value}</span>
      <span className="text-[15px] font-medium text-ink2">{label}</span>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card2 px-4 py-3">
      <p className="text-[12px] font-medium text-ink2">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold">{value}</p>
    </div>
  )
}
