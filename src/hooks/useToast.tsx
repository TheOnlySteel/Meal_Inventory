import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  undo?: () => void
  tone?: 'default' | 'error'
}

interface ToastApi {
  toast: (message: string, opts?: { undo?: () => void; tone?: 'default' | 'error' }) => void
}

const ToastContext = createContext<ToastApi>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, opts?: { undo?: () => void; tone?: 'default' | 'error' }) => {
      const id = ++idRef.current
      setToasts((t) => [...t.slice(-2), { id, message, undo: opts?.undo, tone: opts?.tone }])
      setTimeout(() => dismiss(id), opts?.undo ? 6000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: 'calc(var(--bottom-clearance) + 0.5rem)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-up pointer-events-auto flex items-center gap-3 rounded-2xl glass float-shadow px-4 py-3 text-[15px] font-medium"
            style={t.tone === 'error' ? { color: 'var(--red)' } : undefined}
          >
            <span>{t.message}</span>
            {t.undo && (
              <button
                className="pressable font-semibold text-tint"
                onClick={() => {
                  t.undo?.()
                  dismiss(t.id)
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
