import { useState } from 'react'
import type { FormEvent } from 'react'
import { useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import Sheet from './Sheet'

/** Reminders-style rapid entry: each submit adds an item and keeps the field focused. */
export default function AddItemsSheet({ onClose }: { onClose: () => void }) {
  const { addItem } = useShoppingMutations()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [added, setAdded] = useState(0)

  function submit(e: FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    // Rapid entry stays optimistic; a failure puts the draft back and
    // corrects the counter instead of silently dropping the item.
    setDraft('')
    setAdded((n) => n + 1)
    addItem.mutate(name, {
      onError: () => {
        setAdded((n) => Math.max(n - 1, 0))
        setDraft((d) => d || name)
        toast('Could not add item', { tone: 'error' })
      },
    })
  }

  return (
    <Sheet
      onClose={onClose}
      ariaLabel="Add shopping items"
      panelClassName="flex w-full max-w-lg flex-col rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
        <form onSubmit={submit} className="flex flex-col gap-3 p-5 pb-8 safe-b">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink2">
              {added > 0
                ? `Added ${added} item${added === 1 ? '' : 's'}`
                : 'Add items — return adds each one'}
            </span>
            <button type="button" onClick={close} className="pressable text-[16px] font-semibold text-tint">
              Done
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              data-autofocus
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Milk"
              enterKeyHint="next"
              className="w-full rounded-xl border border-sep bg-elevated px-4 py-3 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Add item"
              className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint text-white disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
