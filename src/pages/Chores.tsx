import { useMemo, useState } from 'react'
import { useChores, useChoreMutations } from '../hooks/useChores'
import { useMembers } from '../hooks/useMembers'
import { useToast } from '../hooks/useToast'
import type { Chore, ChoreInsert } from '../lib/types'
import { groupChores } from '../lib/chores'
import { todayISO } from '../lib/format'
import ChoreRow from '../components/ChoreRow'
import ChoreFormSheet from '../components/ChoreFormSheet'

const SECTIONS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'someday', label: 'Someday' },
  { key: 'done', label: 'Done' },
] as const

export default function Chores() {
  const { data: chores, isLoading, error } = useChores()
  const { data: members } = useMembers()
  const { addChore, updateChore, deleteChore, completeChore, uncompleteChore } =
    useChoreMutations()
  const { toast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Chore | null>(null)

  const groups = useMemo(() => groupChores(chores ?? [], todayISO()), [chores])
  const dueCount = groups.overdue.length + groups.today.length

  function handleToggle(chore: Chore) {
    if (chore.completed_at != null) {
      uncompleteChore.mutate(chore.id)
      return
    }
    completeChore.mutate(chore, {
      onSuccess: (res) => {
        toast(
          res.recurring && res.next_due
            ? `Done · ${chore.title} — next up soon`
            : `Done · ${chore.title}`,
          { undo: () => uncompleteChore.mutate(chore.id) },
        )
      },
      onError: () => toast('Could not update', { tone: 'error' }),
    })
  }

  function handleSave(values: ChoreInsert, editingId?: string) {
    setFormOpen(false)
    setEditing(null)
    if (editingId) {
      // honour the table check: adding recurrence to a completed one-off revives it
      const patch =
        values.recur_interval_days != null ? { ...values, completed_at: null } : values
      updateChore.mutate(
        { id: editingId, patch },
        { onError: () => toast('Save failed', { tone: 'error' }) },
      )
    } else {
      addChore.mutate(values, {
        onSuccess: () => toast(`Added ${values.title}`),
        onError: () => toast('Save failed', { tone: 'error' }),
      })
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <h1 className="text-[28px] font-bold tracking-tight">Chores</h1>
          {dueCount > 0 && (
            <div
              className="flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-white"
              style={{ background: 'var(--orange)' }}
            >
              <span className="text-[15px] font-bold tabular-nums">{dueCount}</span>
              <span className="text-[12px]">due</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-28">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load chores. Check connection.
          </p>
        )}

        {!isLoading && !error && (chores ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-4xl">🧹</span>
            <p className="text-[17px] font-semibold">No chores yet</p>
            <p className="max-w-60 text-[14px] text-ink2">
              Add one-off tasks or recurring routines and hand them out.
            </p>
          </div>
        )}

        {SECTIONS.map(({ key, label }) => {
          const list = groups[key]
          if (list.length === 0) return null
          return (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                {label}
              </h2>
              {list.map((chore) => (
                <ChoreRow
                  key={chore.id}
                  chore={chore}
                  members={members}
                  onToggle={() => handleToggle(chore)}
                  onBody={() => {
                    setEditing(chore)
                    setFormOpen(true)
                  }}
                  onDelete={
                    key === 'done'
                      ? () => deleteChore.mutate(chore.id)
                      : undefined
                  }
                />
              ))}
            </section>
          )
        })}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        aria-label="New chore"
        className="pressable fixed right-5 bottom-[var(--bottom-clearance)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-tint text-white float-shadow"
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {formOpen && (
        <ChoreFormSheet
          editing={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
          onDelete={
            editing
              ? () => {
                  setFormOpen(false)
                  deleteChore.mutate(editing.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
