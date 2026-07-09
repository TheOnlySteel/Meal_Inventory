import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useMembers, useMemberMutations } from '../hooks/useMembers'
import { useToast } from '../hooks/useToast'
import MemberAvatar from './MemberAvatar'

/** Settings sheet: household name, invite code, members, sign out. */
export default function HouseholdSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth()
  const { household } = useHousehold()
  const { data: members } = useMembers()
  const { updateDisplayName } = useMemberMutations()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [editingName, setEditingName] = useState<string | null>(null)

  function saveName() {
    if (editingName == null) return
    const name = editingName.trim()
    setEditingName(null)
    if (!name) return
    updateDisplayName.mutate(name, {
      onSuccess: () => toast('Name updated'),
      onError: () => toast('Could not update name', { tone: 'error' }),
    })
  }

  async function copyCode() {
    if (!household) return
    try {
      await navigator.clipboard.writeText(household.invite_code)
      toast('Invite code copied')
    } catch {
      toast('Could not copy', { tone: 'error' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-up relative z-10 flex w-full max-w-lg flex-col gap-5 rounded-t-3xl bg-elevated p-6 pb-10 float-shadow safe-b sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold tracking-tight">{household?.name ?? 'Household'}</h2>
          <button onClick={onClose} className="pressable text-[16px] font-semibold text-tint">
            Done
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink2">Invite code</span>
          <button
            onClick={copyCode}
            className="pressable flex items-center justify-between rounded-2xl bg-card2 px-5 py-4"
          >
            <span className="font-mono text-[24px] font-bold tracking-[0.25em]">
              {household?.invite_code ?? '——————'}
            </span>
            <span className="text-[14px] font-semibold text-tint">Copy</span>
          </button>
          <p className="text-[12px] text-ink3">
            Share this code so someone can join your household from their own account.
          </p>
        </div>

        {members && members.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink2">Members</span>
            <div className="flex flex-col gap-1 rounded-2xl bg-card2 px-4 py-2">
              {members.map((m) => {
                const isSelf = m.user_id === session?.user.id
                return (
                  <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                    <MemberAvatar userId={m.user_id} name={m.display_name} size={28} />
                    {isSelf && editingName != null ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                        className="min-w-0 flex-1 rounded-lg border border-sep bg-elevated px-2 py-1 text-[15px] outline-none focus:ring-2 focus:ring-tint/60"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                        {m.display_name ?? '—'}
                        {isSelf ? <span className="text-ink3"> (you)</span> : null}
                      </span>
                    )}
                    {m.role === 'owner' && (
                      <span className="shrink-0 text-[11px] font-semibold text-ink3 uppercase">
                        owner
                      </span>
                    )}
                    {isSelf && editingName == null && (
                      <button
                        onClick={() => setEditingName(m.display_name ?? '')}
                        aria-label="Edit your name"
                        className="pressable shrink-0 text-[13px] font-semibold text-tint"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl bg-card2 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink2">Signed in as</p>
            <p className="truncate text-[15px] font-semibold">{session?.user.email}</p>
          </div>
          <button
            onClick={() => {
              qc.clear()
              supabase.auth.signOut()
            }}
            className="pressable shrink-0 text-[14px] font-semibold"
            style={{ color: 'var(--red)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
