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

// Module-level stack so stacked sheets (e.g. recipe detail under its edit
// form) don't fight: only the topmost sheet handles Escape/Tab, and lower
// sheets are inert while covered.
const sheetStack: symbol[] = []
const stackListeners = new Set<() => void>()
function pushSheet(id: symbol) {
  sheetStack.push(id)
  stackListeners.forEach((fn) => fn())
}
function popSheet(id: symbol) {
  const i = sheetStack.indexOf(id)
  if (i >= 0) sheetStack.splice(i, 1)
  stackListeners.forEach((fn) => fn())
}
const isTopSheet = (id: symbol) => sheetStack[sheetStack.length - 1] === id

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
  const [isTop, setIsTop] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<symbol | null>(null)
  if (idRef.current == null) idRef.current = Symbol('sheet')

  const close = useCallback(() => {
    setClosing((was) => {
      if (!was && closeTimer.current == null) {
        closeTimer.current = setTimeout(onClose, reducedMotion() ? 0 : 260)
      }
      return true
    })
  }, [onClose])

  useEffect(() => {
    const id = idRef.current!
    pushSheet(id)
    const update = () => setIsTop(isTopSheet(id))
    update()
    stackListeners.add(update)
    return () => {
      stackListeners.delete(update)
      popSheet(id)
    }
  }, [])

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    // The document itself never scrolls (fixed shell); lock the nearest
    // scrollable ancestor so the page can't scroll behind the sheet.
    let scroller: HTMLElement | null = null
    for (let n = panelRef.current?.parentElement ?? null; n; n = n.parentElement) {
      const { overflowY } = getComputedStyle(n)
      if (overflowY === 'auto' || overflowY === 'scroll') {
        scroller = n
        break
      }
    }
    const prevOverflow = scroller?.style.overflowY ?? ''
    if (scroller) scroller.style.overflowY = 'hidden'

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
        setTimeout(
          () =>
            el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }),
          250,
        )
      }
    }
    const panel = panelRef.current
    panel?.addEventListener('focusin', onFocusIn)

    return () => {
      clearTimeout(focusTimer)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      panel?.removeEventListener('focusin', onFocusIn)
      if (scroller) scroller.style.overflowY = prevOverflow
      returnFocus?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Every open sheet listens on document; only the topmost may act, so
      // Escape peels one layer at a time instead of closing the whole stack.
      if (!isTopSheet(idRef.current!)) return
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
      <div inert={!isTop || undefined} className={`fixed inset-0 z-50 flex ${positionCls}`}>
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
