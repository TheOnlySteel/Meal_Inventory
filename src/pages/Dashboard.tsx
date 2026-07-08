import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useMeals, useMealMutations, useRealtimeSync } from '../hooks/useMeals'
import { useToast } from '../hooks/useToast'
import { freshnessOf } from '../lib/freshness'
import { fmtDateFull, fmtNum } from '../lib/format'
import type { Meal } from '../lib/types'
import FreshnessRing from '../components/FreshnessRing'
import MacroGrid from '../components/MacroGrid'

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
  const { data: meals, isLoading } = useMeals()
  const { eatPack, undoEat } = useMealMutations()
  const { toast } = useToast()
  const [detail, setDetail] = useState<Meal | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = useMemo(
    () => (meals ?? []).filter((m) => m.archived_at == null),
    [meals],
  )

  const stats = useMemo(() => {
    const packs = active.reduce((s, m) => s + m.pack_quantity, 0)
    const urgent = active.filter((m) => freshnessOf(m).daysLeft <= 2).length
    return { meals: active.length, packs, urgent }
  }, [active])

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
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
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

      {/* Grid */}
      <main className="no-scrollbar grid flex-1 auto-rows-min grid-cols-3 gap-4 overflow-y-auto px-8 pb-8 xl:grid-cols-4">
        {isLoading &&
          [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-36" />)}

        {!isLoading && active.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-24">
            <span className="text-6xl">🥡</span>
            <p className="text-[22px] font-semibold text-ink2">The larder is empty</p>
          </div>
        )}

        {active.map((meal) => {
          const fresh = freshnessOf(meal)
          return (
            <button
              key={meal.id}
              onClick={() => setDetail(meal)}
              className="pop-in pressable relative flex flex-col justify-between overflow-hidden rounded-3xl bg-card p-5 text-left card-shadow"
              style={{ borderTop: `5px solid ${fresh.color}` }}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[19px] leading-snug font-semibold">{meal.name}</h3>
                  <p
                    className="mt-0.5 text-[14px] font-medium"
                    style={{ color: fresh.key === 'fresh' ? 'var(--ink-2)' : fresh.color }}
                  >
                    {fresh.label}
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
                <span
                  role="button"
                  aria-label={`Mark one ${meal.name} as taken`}
                  onClick={(e) => tickOff(meal, e)}
                  className="pressable flex h-12 w-12 items-center justify-center rounded-full text-white"
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
                </span>
              </div>
            </button>
          )
        })}
      </main>

      {/* Drill-down overlay */}
      {liveDetail && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
          onClick={() => setDetail(null)}
        >
          <div
            className="pop-in flex max-h-full w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-3xl bg-elevated p-8 float-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
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
                        style={{ color: fresh.color }}
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
                      onClick={() => setDetail(null)}
                      className="pressable rounded-2xl bg-card2 px-8 py-4 text-[17px] font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
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
