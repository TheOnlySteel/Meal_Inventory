import type { KeyboardEvent } from 'react'

/**
 * Keyboard semantics for clickable non-button containers (cards, rows).
 * Spread alongside onClick to make the element focusable and operable.
 */
export function pressableProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
  }
}
