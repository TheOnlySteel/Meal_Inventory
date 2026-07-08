import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useToast } from '../hooks/useToast'

/** Settings sheet: household name, shareable invite code, sign out. */
export default function HouseholdSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth()
  const { household } = useHousehold()
  const { toast } = useToast()
  const qc = useQueryClient()

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
