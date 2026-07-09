import type { Chore, HouseholdMember } from '../lib/types'
import { dueLabel, recurrenceLabel } from '../lib/chores'
import { todayISO } from '../lib/format'
import { memberName } from '../hooks/useMembers'
import { pressableProps } from '../lib/a11y'
import MemberAvatar from './MemberAvatar'

interface Props {
  chore: Chore
  members: HouseholdMember[] | undefined
  onToggle: () => void
  /** Opens the edit sheet; omit for compact contexts (home card). */
  onBody?: () => void
  onDelete?: () => void
}

/** One chore: circle completes, body edits. */
export default function ChoreRow({ chore, members, onToggle, onBody, onDelete }: Props) {
  const today = todayISO()
  const done = chore.completed_at != null
  const overdue = !done && chore.due_date != null && chore.due_date < today
  const recur = recurrenceLabel(chore.recur_interval_days)

  return (
    <div
      onClick={onBody}
      {...(onBody ? pressableProps(onBody) : {})}
      className={`pop-in flex items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow ${
        done ? 'opacity-60' : ''
      } ${onBody ? 'cursor-pointer' : ''}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
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
        <p className={`truncate text-[16px] font-semibold ${done ? 'line-through' : ''}`}>
          {chore.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink2">
          <span style={overdue ? { color: 'var(--orange)', fontWeight: 600 } : undefined}>
            {done ? 'Done' : dueLabel(chore.due_date, today)}
          </span>
          {recur && (
            <span className="rounded-full bg-card2 px-2 py-0.5 font-medium">↻ {recur}</span>
          )}
          {chore.assigned_to && (
            <span className="flex min-w-0 items-center gap-1">
              <MemberAvatar
                userId={chore.assigned_to}
                name={memberName(members, chore.assigned_to)}
                size={16}
              />
              <span className="truncate">{memberName(members, chore.assigned_to)}</span>
            </span>
          )}
        </p>
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${chore.title}`}
          className="pressable hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3"
        >
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
