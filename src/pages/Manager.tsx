import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeals, useMealMutations, useTodayLog } from '../hooks/useMeals'
import { useToast } from '../hooks/useToast'
import { freshnessOf } from '../lib/freshness'
import { fmtNum, todayISO } from '../lib/format'
import type { Meal, MealInsert } from '../lib/types'
import MealCard from '../components/MealCard'
import MealFormSheet from '../components/MealFormSheet'
import { supabase } from '../lib/supabase'

type Filter = 'active' | 'soon' | 'depleted'
type Sort = 'urgency' | 'newest' | 'name' | 'packs'

export default function Manager() {
  const { data: meals, isLoading, error } = useMeals()
  const { data: todayLog } = useTodayLog()
  const { addMeal, updateMeal, eatPack, undoEat, archiveMeal, deleteMeal } = useMealMutations()
  const { toast } = useToast()

  const [filter, setFilter] = useState<Filter>('active')
  const [sort, setSort] = useState<Sort>('urgency')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Meal | null>(null)
  const [template, setTemplate] = useState<Meal | null>(null)

  const all = useMemo(() => meals ?? [], [meals])
  const active = useMemo(() => all.filter((m) => m.archived_at == null), [all])

  const stats = useMemo(() => {
    const packs = active.reduce((s, m) => s + m.pack_quantity, 0)
    const servings = active.reduce((s, m) => s + m.pack_quantity * Number(m.servings_per_pack), 0)
    const urgent = active.filter((m) => freshnessOf(m).daysLeft <= 2).length
    const kcal = active.reduce(
      (s, m) => s + (m.calories ?? 0) * Number(m.servings_per_pack) * m.pack_quantity,
      0,
    )
    return { meals: active.length, packs, servings, urgent, kcal }
  }, [active])

  const today = useMemo(() => {
    const entries = todayLog ?? []
    const packs = entries.reduce((s, e) => s + e.packs, 0)
    const sum = (key: 'calories' | 'protein_g') =>
      entries.reduce(
        (s, e) => s + (e.meals?.[key] ?? 0) * Number(e.meals?.servings_per_pack ?? 1) * e.packs,
        0,
      )
    return { packs, kcal: sum('calories'), protein: sum('protein_g') }
  }, [todayLog])

  const visible = useMemo(() => {
    let list =
      filter === 'depleted'
        ? all.filter((m) => m.archived_at != null)
        : filter === 'soon'
          ? active.filter((m) => freshnessOf(m).daysLeft <= 7)
          : active
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q))
    const sorted = [...list]
    if (sort === 'newest') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'packs') sorted.sort((a, b) => b.pack_quantity - a.pack_quantity)
    // 'urgency' keeps the default best_before ordering from useMeals
    return sorted
  }, [all, active, filter, search, sort])

  function handleEat(meal: Meal) {
    eatPack.mutate(meal, {
      onSuccess: ({ log_id, depleted }) => {
        toast(depleted ? `Last pack of ${meal.name} — moved to history` : `Ate 1 · ${meal.name}`, {
          undo: () => undoEat.mutate(log_id),
        })
      },
      onError: () => toast('Could not update — check connection', { tone: 'error' }),
    })
  }

  function handleSave(values: MealInsert, editingId?: string) {
    setFormOpen(false)
    setEditing(null)
    setTemplate(null)
    if (editingId) {
      updateMeal.mutate(
        { id: editingId, patch: values },
        { onError: () => toast('Save failed', { tone: 'error' }) },
      )
    } else {
      addMeal.mutate(values, {
        onSuccess: () => toast(`Added ${values.name}`),
        onError: () => toast('Save failed', { tone: 'error' }),
      })
    }
  }

  function handleReprep(meal: Meal) {
    setTemplate({ ...meal, prep_date: todayISO() })
    setEditing(null)
    setFormOpen(true)
    setExpandedId(null)
  }

  const filterChips: { key: Filter; label: string }[] = [
    { key: 'active', label: 'In storage' },
    { key: 'soon', label: 'Eat soon' },
    { key: 'depleted', label: 'History' },
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      {/* Header */}
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h1 className="text-[28px] font-bold tracking-tight">Larder</h1>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="pressable text-[13px] font-semibold text-tint">
              Kiosk
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="pressable text-[13px] font-semibold text-ink2"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
          {[
            { v: stats.meals, l: 'meals' },
            { v: stats.packs, l: 'packs' },
            { v: fmtNum(stats.servings), l: 'servings' },
            { v: fmtNum(stats.kcal / 1000, 1) + 'k', l: 'kcal stored' },
          ].map((s) => (
            <div
              key={s.l}
              className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-card2 px-3 py-1.5"
            >
              <span className="text-[15px] font-bold tabular-nums">{s.v}</span>
              <span className="text-[12px] text-ink2">{s.l}</span>
            </div>
          ))}
          {stats.urgent > 0 && (
            <button
              onClick={() => setFilter('soon')}
              className="pressable flex shrink-0 items-baseline gap-1.5 rounded-full px-3 py-1.5 text-white"
              style={{ background: 'var(--orange)' }}
            >
              <span className="text-[15px] font-bold tabular-nums">{stats.urgent}</span>
              <span className="text-[12px]">need eating</span>
            </button>
          )}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-2 px-4 pb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meals"
            className="w-full rounded-xl bg-card2 px-4 py-2 text-[16px] outline-none placeholder:text-ink3 focus:ring-2 focus:ring-tint/50"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded-lg bg-card2 p-0.5">
              {filterChips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={`pressable rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    filter === c.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg bg-card2 px-2 py-1.5 text-[13px] font-semibold text-ink2 outline-none"
            >
              <option value="urgency">By urgency</option>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="packs">Most packs</option>
            </select>
          </div>
        </div>
      </header>

      {/* Today panel */}
      {today.packs > 0 && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl bg-card card-shadow px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink2">Eaten today</p>
            <p className="text-[15px] font-semibold">
              {today.packs} pack{today.packs === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-[17px] font-bold tabular-nums">{fmtNum(today.kcal)}</p>
              <p className="text-[11px] text-ink2">kcal</p>
            </div>
            <div>
              <p className="text-[17px] font-bold tabular-nums">{fmtNum(today.protein)}g</p>
              <p className="text-[11px] text-ink2">protein</p>
            </div>
          </div>
        </div>
      )}

      {/* Meal list */}
      <main className="flex flex-1 flex-col gap-3 px-4 py-4 pb-40">
        {isLoading &&
          [1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load meals. Pull to refresh or check connection.
          </p>
        )}

        {!isLoading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-4xl">🥡</span>
            <p className="text-[17px] font-semibold">
              {search
                ? 'No meals match'
                : filter === 'depleted'
                  ? 'Nothing in history yet'
                  : filter === 'soon'
                    ? 'Nothing needs eating soon'
                    : 'Your larder is empty'}
            </p>
            {filter === 'active' && !search && (
              <p className="max-w-60 text-[14px] text-ink2">
                Tap the + button to log your first prepped meal.
              </p>
            )}
          </div>
        )}

        {visible.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            expanded={expandedId === meal.id}
            onToggle={() => setExpandedId((id) => (id === meal.id ? null : meal.id))}
            onEat={() => handleEat(meal)}
            onEdit={() => {
              setEditing(meal)
              setTemplate(null)
              setFormOpen(true)
            }}
            onReprep={() => handleReprep(meal)}
            onArchive={() => {
              archiveMeal.mutate({ id: meal.id, archived: true })
              toast(`Archived ${meal.name}`, {
                undo: () => archiveMeal.mutate({ id: meal.id, archived: false }),
              })
            }}
            onRestore={() => archiveMeal.mutate({ id: meal.id, archived: false })}
            onDelete={() => {
              if (confirm(`Delete “${meal.name}” and its history? This can’t be undone.`)) {
                deleteMeal.mutate(meal.id)
              }
            }}
          />
        ))}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          setEditing(null)
          setTemplate(null)
          setFormOpen(true)
        }}
        aria-label="New meal"
        className="pressable fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-tint text-white float-shadow"
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {formOpen && (
        <MealFormSheet
          editing={editing}
          template={template}
          history={all}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
            setTemplate(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
