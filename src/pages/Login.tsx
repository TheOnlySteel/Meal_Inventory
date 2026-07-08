import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-6">
      {/* ambient gradient blobs */}
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

      <form
        onSubmit={onSubmit}
        className="pop-in relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-3xl glass card-shadow p-8"
      >
        <div className="mb-2 flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-16 w-16 rounded-2xl card-shadow" />
          <div className="text-center">
            <h1 className="text-[28px] font-bold tracking-tight">Larder</h1>
            <p className="text-[15px] text-ink2">Your meal prep inventory</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink2">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-sep bg-elevated px-4 py-3 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink2">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-sep bg-elevated px-4 py-3 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="fade-in text-center text-[13px] font-medium" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="pressable mt-2 rounded-xl bg-tint py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
