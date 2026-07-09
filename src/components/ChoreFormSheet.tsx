import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Chore, ChoreInsert } from '../lib/types'
import { RECURRENCE_OPTIONS } from '../lib/types'
import { useMembers } from '../hooks/useMembers'
import { useAuth } from '../hooks/useAuth'
import MemberAvatar from './MemberAvatar'
import Sheet from './Sheet'
import Icon from './Icon'

interface Props {
  editing?: Chore | null
  onClose: () => void
  onSave: (values: ChoreInsert, editingId?: string) => void
  onDelete?: () => void
}

export default function ChoreFormSheet({ editing, onClose, onSave, onDelete }: Props) {
  const { data: members } = useMembers()
  const { session } = useAuth()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [assignee, setAssignee] = useState<string | null>(editing?.assigned_to ?? null)
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '')
  const [recurDays, setRecurDays] = useState<number | null>(editing?.recur_interval_days ?? null)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(
      {
        title: title.trim(),
        notes: notes.trim() || null,
        assigned_to: assignee,
        due_date: dueDate || null,
        recur_interval_days: recurDays,
      },
      editing?.id,
    )
  }

  const inputCls =
    'rounded-xl border border-sep bg-elevated px-3.5 py-2.5 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60 w-full'
  const labelCls = 'text-[13px] font-medium text-ink2'
  const chipCls = (active: boolean) =>
    `pressable flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
      active ? 'bg-tint text-white' : 'bg-card2 text-ink2'
    }`

  return (
    <Sheet
      onClose={onClose}
      ariaLabel={editing ? 'Edit chore' : 'New chore'}
      panelClassName="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
      <form onSubmit={submit} className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" onClick={close} className="pressable text-[16px] text-tint">
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold">{editing ? 'Edit chore' : 'New chore'}</h2>
          <button
            type="submit"
            disabled={!title.trim()}
            className="pressable text-[16px] font-semibold text-tint disabled:opacity-40"
          >
            {editing ? 'Save' : 'Add'}
          </button>
        </div>

        <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-8 safe-b">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Chore</span>
            <input
              className={inputCls}
              value={title}
              required
              data-autofocus={!editing || undefined}
              placeholder="e.g. Water the plants"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Who</span>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button type="button" onClick={() => setAssignee(null)} className={chipCls(assignee == null)}>
                Anyone
              </button>
              {(members ?? []).map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setAssignee(m.user_id)}
                  className={chipCls(assignee === m.user_id)}
                >
                  <MemberAvatar userId={m.user_id} name={m.display_name} size={18} />
                  {m.display_name ?? 'Member'}
                  {m.user_id === session?.user.id ? ' (you)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Due</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="pressable shrink-0 rounded-full bg-card2 px-3 py-1.5 text-[13px] font-semibold text-ink2"
                >
                  No date
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Repeats</span>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {RECURRENCE_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setRecurDays(o.days)}
                  className={chipCls(recurDays === o.days)}
                >
                  {o.days != null ? <Icon name="repeat" size={12} /> : null}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Notes</span>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={notes}
              placeholder="Details, where things are…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {editing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="pressable rounded-xl bg-card2 py-3 text-[15px] font-semibold"
              style={{ color: 'var(--red)' }}
            >
              Delete chore
            </button>
          )}
        </div>
      </form>
      )}
    </Sheet>
  )
}
