import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useShopping, useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import type { ShoppingItem } from '../lib/types'
import { pressableProps } from '../lib/a11y'
import Icon from '../components/Icon'

export default function Shopping() {
  const { data: items, isLoading, error } = useShopping()
  const { addItem, setChecked, clearChecked, restoreItems, deleteItem } = useShoppingMutations()
  const { toast } = useToast()
  const [draft, setDraft] = useState('')

  const { open, done } = useMemo(() => {
    const all = items ?? []
    return {
      open: all.filter((i) => i.checked_at == null),
      done: all.filter((i) => i.checked_at != null),
    }
  }, [items])

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    setDraft('')
    addItem.mutate(name, {
      onError: () => toast('Could not add item', { tone: 'error' }),
    })
  }

  function onClearChecked() {
    const cleared = [...done]
    clearChecked.mutate(cleared, {
      onSuccess: () => {
        toast(`Cleared ${cleared.length} item${cleared.length === 1 ? '' : 's'}`, {
          undo: () => restoreItems.mutate(cleared),
        })
      },
      onError: () => toast('Could not clear', { tone: 'error' }),
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="px-4 pt-3 pb-1">
          <h1 className="text-[28px] font-bold tracking-tight">Shopping</h1>
        </div>
        <form onSubmit={onAdd} className="flex gap-2 px-4 pb-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an item…"
            enterKeyHint="done"
            className="w-full rounded-xl bg-card2 px-4 py-2 text-[16px] outline-none placeholder:text-ink3 focus:ring-2 focus:ring-tint/50"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Add item"
            className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint text-white disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </form>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-4 pb-[calc(var(--bottom-clearance)+4.5rem)]">
        {isLoading && [1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full" />)}

        {error && (
          <p className="py-8 text-center text-[15px]" style={{ color: 'var(--red)' }}>
            Couldn’t load the list. Check connection.
          </p>
        )}

        {!isLoading && !error && open.length === 0 && done.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Icon name="cart" size={52} strokeWidth={1.1} className="text-ink3" />
            <p className="text-[17px] font-semibold">Nothing to buy</p>
            <p className="max-w-60 text-[14px] text-ink2">
              Add items above, or send “to make” meals here from the planner.
            </p>
          </div>
        )}

        {open.length > 0 && (
          <div className="flex flex-col gap-2">
            {open.map((item) => (
              <Row key={item.id} item={item} onToggle={() => setChecked.mutate({ id: item.id, checked: true })} onDelete={() => deleteItem.mutate(item.id)} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-ink2">
                Checked · {done.length}
              </span>
              <button
                onClick={onClearChecked}
                className="pressable text-[13px] font-semibold text-tint"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {done.map((item) => (
                <Row key={item.id} item={item} checked onToggle={() => setChecked.mutate({ id: item.id, checked: false })} onDelete={() => deleteItem.mutate(item.id)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Row({
  item,
  checked = false,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem
  checked?: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onToggle}
      {...pressableProps(onToggle)}
      aria-label={`${item.name} — ${checked ? 'checked, tap to uncheck' : 'tap to check off'}`}
      className={`pop-in pressable flex cursor-pointer items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow ${
        checked ? 'opacity-60' : ''
      }`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor: checked ? 'var(--tint)' : 'var(--sep)',
          background: checked ? 'var(--tint)' : 'transparent',
        }}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path
              d="M5 12.5 10 17.5 19 7"
              fill="none"
              stroke="white"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[16px] font-medium ${checked ? 'line-through' : ''}`}>
        {item.name}
        {item.quantity ? <span className="ml-2 text-[13px] text-ink2">{item.quantity}</span> : null}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label={`Delete ${item.name}`}
        className="pressable hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
