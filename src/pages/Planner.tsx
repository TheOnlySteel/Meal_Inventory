import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, isSameDay, isToday, parseISO } from 'date-fns'
import { usePlan, usePlanMutations, planRange } from '../hooks/usePlanner'
import { useChores, useChoreMutations } from '../hooks/useChores'
import { useMeals } from '../hooks/useMeals'
import { memberName, useMembers } from '../hooks/useMembers'
import { useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import { useToday } from '../hooks/useToday'
import { groupChores } from '../lib/chores'
import { eatErrorMessage } from '../lib/errors'
import ChoreRow from '../components/ChoreRow'
import { freshnessOf } from '../lib/freshness'
import { fmtNum } from '../lib/format'
import type { Meal, PlanEntry } from '../lib/types'
import { PLAN_SLOTS } from '../lib/types'
import PlanEntrySheet from '../components/PlanEntrySheet'
import ActionSheet from '../components/ActionSheet'
import MemberAvatar from '../components/MemberAvatar'
import Icon from '../components/Icon'

const DAY_COUNT = 22 // -7 … +14

export default function Planner() {
  const { data: entries, isLoading, error } = usePlan()
  const { addEntry, updateEntry, completeEntry, uncompleteEntry, deleteEntry } =
    usePlanMutations()
  const { data: chores } = useChores()
  const { data: meals } = useMeals()
  const { data: members } = useMembers()
  const { completeChore, uncompleteChore } = useChoreMutations()
  const { addItem } = useShoppingMutations()
  const { toast } = useToast()
  const todayIso = useToday()
  const [view, setView] = useState<'day' | 'week'>('day')
  const [selected, setSelected] = useState(() => new Date())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetDate, setSheetDate] = useState<Date | null>(null)
  const [entryActions, setEntryActions] = useState<PlanEntry | null>(null)
  const [dayPick, setDayPick] = useState<{ entry: PlanEntry; mode: 'move' | 'copy' } | null>(null)
  const [assignPick, setAssignPick] = useState<PlanEntry | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const { start } = planRange(todayIso)
    return Array.from({ length: DAY_COUNT }, (_, i) => addDays(start, i))
  }, [todayIso])

  const byDay = useMemo(() => {
    const map = new Map<string, PlanEntry[]>()
    for (const e of entries ?? []) {
      const list = map.get(e.plan_date) ?? []
      list.push(e)
      map.set(e.plan_date, list)
    }
    return map
  }, [entries])

  const dayEntries = useMemo(
    () => byDay.get(format(selected, 'yyyy-MM-dd')) ?? [],
    [byDay, selected],
  )
  const populatedSlots = PLAN_SLOTS.filter((s) => dayEntries.some((e) => e.slot === s.key))

  const toMake = useMemo(
    () =>
      (entries ?? []).filter((e) => e.meal_id == null && e.title && e.completed_at == null),
    [entries],
  )

  // Overdue + due-today chores for the home card (today only)
  const todayChores = useMemo(() => {
    const g = groupChores(chores ?? [], todayIso)
    return [...g.overdue, ...g.today]
  }, [chores, todayIso])

  function toggleChore(chore: (typeof todayChores)[number]) {
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

  // Follow the calendar: when the day rolls over, jump selection back to today
  useEffect(() => {
    setSelected(parseISO(todayIso))
  }, [todayIso])

  // Center today's pill on mount and at each rollover. Scroll the strip
  // directly — scrollIntoView also scrolls the document, which left the whole
  // PWA shifted upward at launch on iOS.
  useEffect(() => {
    const strip = stripRef.current
    const pill = strip?.querySelector<HTMLElement>('[data-today="true"]')
    if (!strip || !pill) return
    strip.scrollLeft = pill.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2
  }, [todayIso, view])

  function displayName(e: PlanEntry) {
    return e.meals?.name ?? e.title ?? 'Untitled'
  }

  // Next 14 days for the week view and the move/copy pickers
  const upcoming = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(parseISO(todayIso), i)),
    [todayIso],
  )

  // Urgency-ranked larder meals not yet planned today (useMeals is pre-sorted)
  const suggestions = useMemo(() => {
    const planned = new Set(dayEntries.map((e) => e.meal_id).filter(Boolean))
    return (meals ?? [])
      .filter((m) => m.archived_at == null && m.pack_quantity > 0 && !planned.has(m.id))
      .slice(0, 3)
  }, [meals, dayEntries])

  function dayLabel(iso: string) {
    return iso === todayIso ? 'today' : format(parseISO(iso), 'EEE, MMM d')
  }

  function moveEntry(entry: PlanEntry, iso: string) {
    updateEntry.mutate(
      { id: entry.id, patch: { plan_date: iso } },
      {
        onSuccess: () => toast(`Moved to ${dayLabel(iso)}`),
        onError: () => toast('Could not move', { tone: 'error' }),
      },
    )
  }

  function copyEntry(entry: PlanEntry, iso: string) {
    addEntry.mutate(
      {
        plan_date: iso,
        slot: entry.slot,
        servings: entry.servings,
        notes: entry.notes,
        ...(entry.meal_id ? { meal_id: entry.meal_id } : { title: entry.title ?? 'Untitled' }),
        ...(entry.assigned_to ? { assigned_to: entry.assigned_to } : {}),
      },
      {
        onSuccess: () => toast(`Copied to ${dayLabel(iso)}`),
        onError: () => toast('Could not copy', { tone: 'error' }),
      },
    )
  }

  function assignEntry(entry: PlanEntry, userId: string | null) {
    updateEntry.mutate(
      { id: entry.id, patch: { assigned_to: userId } },
      { onError: () => toast('Could not update', { tone: 'error' }) },
    )
  }

  function planSuggestion(meal: Meal) {
    addEntry.mutate(
      { plan_date: todayIso, slot: 'dinner', meal_id: meal.id },
      {
        onSuccess: () => toast(`${meal.name} planned for dinner`),
        onError: () => toast('Could not save', { tone: 'error' }),
      },
    )
  }

  function onComplete(entry: PlanEntry) {
    completeEntry.mutate(entry, {
      onSuccess: () => {
        toast(entry.meal_id ? `Ate 1 · ${displayName(entry)}` : `Done · ${displayName(entry)}`, {
          undo: () => uncompleteEntry.mutate(entry.id),
        })
      },
      onError: (err) => toast(eatErrorMessage(err, displayName(entry)), { tone: 'error' }),
    })
  }

  function onSendToShopping(entry: PlanEntry) {
    addItem.mutate(
      { raw: displayName(entry) },
      {
        onSuccess: () => toast(`Added ${displayName(entry)} to shopping`),
        onError: () => toast('Could not add', { tone: 'error' }),
      },
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="flex items-end justify-between px-4 pt-3 pb-1">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">
              {view === 'week' ? 'Coming up' : isToday(selected) ? 'Today' : format(selected, 'EEEE')}
            </h1>
            <p className="text-[13px] font-medium text-ink2">
              {view === 'week' ? 'Next two weeks' : format(selected, 'MMMM d')}
            </p>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex rounded-lg bg-card2 p-0.5">
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`pressable rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    view === v ? 'bg-card text-ink card-shadow' : 'text-ink2'
                  }`}
                >
                  {v === 'day' ? 'Day' : 'Week'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setSheetDate(null)
                setSheetOpen(true)
              }}
              className="pressable rounded-full bg-tint px-4 py-1.5 text-[14px] font-semibold text-white"
            >
              + Add
            </button>
          </div>
        </div>
        {/* Day strip */}
        {view === 'day' && (
        <div
          ref={stripRef}
          className="no-scrollbar relative flex snap-x snap-proximity scroll-pl-4 gap-1.5 overflow-x-auto px-4 pt-1 pb-3"
        >
          {days.map((day) => {
            const iso = format(day, 'yyyy-MM-dd')
            const active = isSameDay(day, selected)
            const today = isToday(day)
            const past = iso < todayIso
            const dayList = byDay.get(iso) ?? []
            const hasOpen = dayList.some((e) => e.completed_at == null)
            const hasAny = dayList.length > 0
            return (
              <button
                key={iso}
                data-today={today}
                onClick={() => setSelected(day)}
                className={`pressable flex w-12 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                  active ? 'bg-tint text-white' : 'bg-card2 text-ink'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    active ? 'text-white/80' : today ? 'text-tint' : past ? 'text-ink3' : 'text-ink2'
                  }`}
                >
                  {today ? 'Today' : format(day, 'EEE')}
                </span>
                <span
                  className={`text-[17px] leading-none font-bold tabular-nums ${
                    past && !active ? 'text-ink3' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    background: hasOpen
                      ? active
                        ? 'white'
                        : 'var(--tint)'
                      : hasAny
                        ? active
                          ? 'rgba(255,255,255,0.5)'
                          : 'var(--ink-3)'
                        : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-[calc(var(--bottom-clearance)+4.5rem)]">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load the plan. Check connection.
          </p>
        )}

        {/* Week agenda: next two weeks, tap a chip for entry actions */}
        {view === 'week' &&
          !isLoading &&
          !error &&
          upcoming.map((day, i) => {
            const iso = format(day, 'yyyy-MM-dd')
            const list = byDay.get(iso) ?? []
            const today = iso === todayIso
            return (
              <div key={iso} className="flex flex-col gap-2">
                {i === 7 && (
                  <p className="mt-1 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                    Next week
                  </p>
                )}
                <div className="rounded-2xl bg-card px-4 py-3 card-shadow">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelected(day)
                        setView('day')
                      }}
                      className={`pressable text-[14px] font-semibold ${today ? 'text-tint' : ''}`}
                    >
                      {today ? 'Today' : format(day, 'EEEE, MMM d')}
                    </button>
                    <button
                      onClick={() => {
                        setSheetDate(day)
                        setSheetOpen(true)
                      }}
                      aria-label={`Add to ${format(day, 'MMM d')}`}
                      className="pressable hit flex h-7 w-7 items-center justify-center rounded-full bg-card2 text-tint"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                  {list.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {list.map((entry) => {
                        const done = entry.completed_at != null
                        const slotDef = PLAN_SLOTS.find((s) => s.key === entry.slot)
                        return (
                          <button
                            key={entry.id}
                            onClick={() => setEntryActions(entry)}
                            className={`pressable flex items-center gap-1.5 rounded-full bg-card2 px-3 py-1.5 text-[13px] font-semibold ${
                              done ? 'text-ink3 line-through' : ''
                            }`}
                          >
                            {slotDef && <Icon name={slotDef.icon} size={12} />}
                            <span className="max-w-40 truncate">{displayName(entry)}</span>
                            {entry.assigned_to && (
                              <MemberAvatar
                                userId={entry.assigned_to}
                                name={memberName(members, entry.assigned_to)}
                                size={16}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

        {view === 'day' && !isLoading && !error && dayEntries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Icon name="calendar" size={52} strokeWidth={1.1} className="text-ink3" />
            <p className="text-[17px] font-semibold">Nothing planned for this day</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="pressable mt-1 rounded-full bg-tint px-5 py-2 text-[14px] font-semibold text-white"
            >
              Plan something
            </button>
          </div>
        )}

        {view === 'day' &&
          !isLoading &&
          !error &&
          populatedSlots.map((slot) => {
            const slotEntries = dayEntries.filter((e) => e.slot === slot.key)
            return (
              <section key={slot.key} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                  <Icon name={slot.icon} size={14} /> {slot.label}
                </h2>
                {slotEntries.map((entry) => {
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
                        className="pressable hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
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
                          {entry.assigned_to && (
                            <span className="flex min-w-0 items-center gap-1">
                              <MemberAvatar
                                userId={entry.assigned_to}
                                name={memberName(members, entry.assigned_to)}
                                size={16}
                              />
                              <span className="truncate">
                                {memberName(members, entry.assigned_to)}
                              </span>
                            </span>
                          )}
                          {entry.notes ? <span className="truncate">· {entry.notes}</span> : null}
                        </p>
                      </div>
                      <button
                        onClick={() => setEntryActions(entry)}
                        aria-label={`Options for ${displayName(entry)}`}
                        className="pressable hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="19" cy="12" r="1.8" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </section>
            )
          })}

        {/* Urgency-ranked ideas for tonight while dinner is still open */}
        {view === 'day' &&
          isToday(selected) &&
          !dayEntries.some((e) => e.slot === 'dinner') &&
          suggestions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                <Icon name="sparkle" size={14} /> Suggested tonight
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((m) => {
                  const fresh = freshnessOf(m)
                  return (
                    <button
                      key={m.id}
                      onClick={() => planSuggestion(m)}
                      className="pressable flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[13px] font-semibold card-shadow"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: fresh.color }}
                      />
                      <span className="max-w-44 truncate">{m.name}</span>
                      <span className="font-normal text-ink2">
                        {m.pack_quantity} left
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

        {/* Today's chores — home is the source of truth for the day */}
        {view === 'day' && isToday(selected) && todayChores.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
              <Icon name="checklist" size={14} /> Today’s chores
            </h2>
            {todayChores.map((chore) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                members={members}
                onToggle={() => toggleChore(chore)}
              />
            ))}
          </section>
        )}

        {/* To-make roundup across the whole strip */}
        {toMake.length > 0 && (
          <section className="mt-2 flex flex-col gap-2 rounded-2xl bg-card p-4 card-shadow">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
              <Icon name="chefhat" size={14} /> To make
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

      {sheetOpen && (
        <PlanEntrySheet
          date={sheetDate ?? selected}
          onClose={() => {
            setSheetOpen(false)
            setSheetDate(null)
          }}
        />
      )}

      {entryActions && (
        <ActionSheet
          title={displayName(entryActions)}
          message={`${format(parseISO(entryActions.plan_date), 'EEE, MMM d')} · ${
            PLAN_SLOTS.find((s) => s.key === entryActions.slot)?.label ?? ''
          }`}
          actions={[
            {
              label: entryActions.completed_at != null ? 'Mark not done' : 'Mark done',
              onSelect: () =>
                entryActions.completed_at != null
                  ? uncompleteEntry.mutate(entryActions.id)
                  : onComplete(entryActions),
            },
            {
              label: 'Move to tomorrow',
              onSelect: () =>
                moveEntry(entryActions, format(addDays(parseISO(todayIso), 1), 'yyyy-MM-dd')),
            },
            {
              label: 'Move to another day…',
              onSelect: () => setDayPick({ entry: entryActions, mode: 'move' }),
            },
            {
              label: 'Copy to another day…',
              onSelect: () => setDayPick({ entry: entryActions, mode: 'copy' }),
            },
            { label: 'Assign…', onSelect: () => setAssignPick(entryActions) },
            {
              label: 'Remove from plan',
              tone: 'destructive',
              onSelect: () => deleteEntry.mutate(entryActions.id),
            },
          ]}
          onClose={() => setEntryActions(null)}
        />
      )}

      {dayPick && (
        <ActionSheet
          title={`${dayPick.mode === 'move' ? 'Move' : 'Copy'} ${displayName(dayPick.entry)}`}
          actions={upcoming
            .map((d) => format(d, 'yyyy-MM-dd'))
            .filter((iso) => !(dayPick.mode === 'move' && iso === dayPick.entry.plan_date))
            .map((iso) => ({
              label: iso === todayIso ? 'Today' : format(parseISO(iso), 'EEEE, MMM d'),
              onSelect: () =>
                dayPick.mode === 'move'
                  ? moveEntry(dayPick.entry, iso)
                  : copyEntry(dayPick.entry, iso),
            }))}
          onClose={() => setDayPick(null)}
        />
      )}

      {assignPick && (
        <ActionSheet
          title={`Assign ${displayName(assignPick)}`}
          actions={[
            { label: 'Anyone', onSelect: () => assignEntry(assignPick, null) },
            ...(members ?? []).map((m) => ({
              label: m.display_name ?? 'Member',
              onSelect: () => assignEntry(assignPick, m.user_id),
            })),
          ]}
          onClose={() => setAssignPick(null)}
        />
      )}
    </div>
  )
}
