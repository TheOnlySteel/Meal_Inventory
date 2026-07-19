import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseholdMutations } from '../hooks/useHousehold'
import Icon from '../components/Icon'

/** First-run screen: create a household or join one with an invite code. */
export default function HouseholdSetup() {
  const { createHousehold, joinHousehold } = useHouseholdMutations()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = createHousehold.isPending || joinHousehold.isPending

  function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    createHousehold.mutate(name, {
      onError: (err) => setError(err.message),
    })
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    joinHousehold.mutate(code, {
      onError: (err) =>
        setError(err.message.includes('Invalid') ? 'Invalid invite code' : err.message),
    })
  }

  const inputCls =
    'rounded-xl border border-sep bg-elevated px-4 py-3 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60'

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--green)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--tint)' }}
      />

      {/* Scrollable so landscape phones and large text can reach every field */}
      <div className="relative z-10 flex h-full flex-col overflow-y-auto overscroll-y-contain px-6 py-6">
      <div className="pop-in m-auto flex w-full max-w-sm flex-col gap-5 rounded-3xl glass card-shadow p-8">
        <div className="text-center">
          <Icon name="house" size={44} strokeWidth={1.3} className="mx-auto text-tint" />
          <h1 className="mt-2 text-[24px] font-bold tracking-tight">Set up your household</h1>
          <p className="mt-1 text-[14px] text-ink2">
            Meals, plans and shopping lists are shared with everyone in your household.
          </p>
        </div>

        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-ink2" htmlFor="hh-name">
            Start fresh
          </label>
          <input
            id="hh-name"
            className={inputCls}
            value={name}
            placeholder="Household name, e.g. Home"
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="pressable rounded-xl bg-tint py-3 text-[16px] font-semibold text-white disabled:opacity-40"
          >
            Create household
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-sep" />
          <span className="text-[12px] font-medium text-ink3">or</span>
          <div className="h-px flex-1 bg-sep" />
        </div>

        <form onSubmit={onJoin} className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-ink2" htmlFor="hh-code">
            Have an invite code?
          </label>
          <input
            id="hh-code"
            className={`${inputCls} text-center font-mono text-[20px] tracking-[0.3em] uppercase`}
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="pressable rounded-xl bg-card2 py-3 text-[16px] font-semibold text-tint disabled:opacity-40"
          >
            Join household
          </button>
        </form>

        {error && (
          <p className="fade-in text-center text-[13px] font-medium" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="pressable self-center text-[13px] font-semibold text-ink2"
        >
          Sign out
        </button>
      </div>
      </div>
    </div>
  )
}
