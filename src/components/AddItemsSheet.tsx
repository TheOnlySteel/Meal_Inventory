import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useCatalog, useShopping, useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import { STORES, nameKey, parseItemInput } from '../lib/groceries'
import Sheet from './Sheet'

/** Reminders-style rapid entry: each submit adds an item and keeps the field focused. */
export default function AddItemsSheet({ onClose }: { onClose: () => void }) {
  const { addItem } = useShoppingMutations()
  const { data: catalog } = useCatalog()
  const { data: items } = useShopping()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [added, setAdded] = useState(0)
  // null = follow the item's remembered store; sticky once tapped so a run of
  // new Costco items only needs one tap.
  const [manualStore, setManualStore] = useState<string | null>(null)

  const draftKey = nameKey(parseItemInput(draft).name)
  const learnedStore = catalog?.find((c) => c.name_key === draftKey)?.store
  const effectiveStore = manualStore ?? learnedStore ?? 'grocery'

  // Most-added remembered items not already on the open list
  const quickAdds = useMemo(() => {
    const openKeys = new Set(
      (items ?? []).filter((i) => i.checked_at == null).map((i) => nameKey(i.name)),
    )
    return (catalog ?? [])
      .filter((c) => !openKeys.has(c.name_key) && c.times_added > 1)
      .sort((a, b) => b.times_added - a.times_added)
      .slice(0, 6)
  }, [catalog, items])

  function add(raw: string, store?: string) {
    setAdded((n) => n + 1)
    addItem.mutate(
      { raw, store },
      {
        onError: () => {
          setAdded((n) => Math.max(n - 1, 0))
          setDraft((d) => d || raw)
          toast('Could not add item', { tone: 'error' })
        },
      },
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const raw = draft.trim()
    if (!raw) return
    setDraft('')
    add(raw, manualStore ?? undefined)
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

          {/* Destination store; auto-follows the item's memory until tapped */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-card2 p-0.5">
              {STORES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setManualStore(s.key)}
                  aria-pressed={effectiveStore === s.key}
                  className={`pressable rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    effectiveStore === s.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {manualStore == null && learnedStore && (
              <span className="text-[12px] text-ink3">remembered</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              data-autofocus
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Milk, 2L milk, 3x yoghurt"
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

          {quickAdds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickAdds.map((c) => (
                <button
                  key={c.name_key}
                  type="button"
                  onClick={() => add(c.display_name)}
                  className="pressable flex items-center gap-1.5 rounded-full bg-card2 px-3 py-1.5 text-[13px] font-semibold"
                >
                  {c.display_name}
                  {c.store === 'costco' && <span className="font-normal text-ink2">Costco</span>}
                </button>
              ))}
            </div>
          )}
        </form>
      )}
    </Sheet>
  )
}
