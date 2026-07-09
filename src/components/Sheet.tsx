import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const SheetCloseContext = createContext<() => void>(() => {})

/** Close the enclosing Sheet with its exit animation (use for Cancel/Done buttons). */
export function useSheetClose() {
  return useContext(SheetCloseContext)
}

interface Props {
  onClose: () => void
  /** Render-prop form receives close() so triggers can animate out. */
  children: ReactNode | ((close: () => void) => ReactNode)
  /** bottom sheet (default) or centered dialog (kiosk drill-down) */
  variant?: 'bottom' | 'center'
  /** classes for the panel in addition to the shared chrome */
  panelClassName?: string
  ariaLabel?: string
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Shared modal shell: backdrop, enter/exit animations, Escape-to-close,
 * body scroll lock, focus restore, Tab containment, and keyboard-aware
 * scrolling of focused inputs. Fields marked data-autofocus are focused
 * after the enter animation so the iOS keyboard doesn't jump mid-slide.
 */
export default function Sheet({
  onClose,
  children,
  variant = 'bottom',
  panelClassName = '',
  ariaLabel,
}: Props) {
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setClosing((was) => {
      if (!was && closeTimer.current == null) {
        closeTimer.current = setTimeout(onClose, reducedMotion() ? 0 : 260)
      }
      return true
    })
  }, [onClose])

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the marked field (or the panel) once the slide-up settles
    const focusTimer = setTimeout(
      () => {
        const target =
          panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current
        target?.focus?.()
      },
      reducedMotion() ? 0 : 340,
    )

    // Keep the focused input visible above the iOS keyboard
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.matches?.('input, textarea, select')) {
        setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
      }
    }
    const panel = panelRef.current
    panel?.addEventListener('focusin', onFocusIn)

    return () => {
      clearTimeout(focusTimer)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      panel?.removeEventListener('focusin', onFocusIn)
      document.body.style.overflow = prevOverflow
      returnFocus?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  const positionCls =
    variant === 'bottom'
      ? 'items-end justify-center sm:items-center'
      : 'items-center justify-center'
  const enterCls = variant === 'bottom' ? 'sheet-up' : 'pop-in'
  const exitCls = variant === 'bottom' ? 'sheet-down' : 'pop-out'

  return (
    <SheetCloseContext.Provider value={close}>
      <div className={`fixed inset-0 z-50 flex ${positionCls}`}>
        <div
          className={`absolute inset-0 bg-black/40 ${closing ? 'fade-out' : 'fade-in'}`}
          onClick={close}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`relative z-10 outline-none ${closing ? exitCls : enterCls} ${panelClassName}`}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      </div>
    </SheetCloseContext.Provider>
  )
}
