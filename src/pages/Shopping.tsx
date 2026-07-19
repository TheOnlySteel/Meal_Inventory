import { useMemo, useState } from 'react'
import { useShopping, useShoppingMutations } from '../hooks/useShopping'
import { useToast } from '../hooks/useToast'
import type { ShoppingItem } from '../lib/types'
import { CATEGORIES, categoryLabel, storeLabel } from '../lib/groceries'
import Icon from '../components/Icon'
import ActionSheet from '../components/ActionSheet'
import AddItemsSheet from '../components/AddItemsSheet'

type StoreFilter = 'all' | 'grocery' | 'costco'

export default function Shopping() {
  const { data: items, isLoading, error } = useShopping()
  const { setChecked, clearChecked, restoreItems, deleteItem, updateItem, rememberItem } =
    useShoppingMutations()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all')
  const [itemActions, setItemActions] = useState<ShoppingItem | null>(null)
  const [categoryPick, setCategoryPick] = useState<ShoppingItem | null>(null)

  const { open, done } = useMemo(() => {
    const all = (items ?? []).filter((i) => storeFilter === 'all' || i.store === storeFilter)
    return {
      open: all.filter((i) => i.checked_at == null),
      done: all.filter((i) => i.checked_at != null),
    }
  }, [items, storeFilter])

  // Grocery items grouped in store-walk order; Costco is its own trip below.
  const grocerySections = useMemo(() => {
    const grocery = open.filter((i) => i.store !== 'costco')
    const byCat = new Map<string | null, ShoppingItem[]>()
    for (const i of grocery) {
      const k = i.category && CATEGORIES.some((c) => c.key === i.category) ? i.category : null
      byCat.set(k, [...(byCat.get(k) ?? []), i])
    }
    const sections = [
      ...CATEGORIES.map((c) => ({ key: c.key, label: c.label, items: byCat.get(c.key) ?? [] })),
      { key: 'other', label: 'Other', items: byCat.get(null) ?? [] },
    ].filter((s) => s.items.length > 0)
    return { sections, flat: sections.length === 1 && sections[0].key === 'other' }
  }, [open])

  const costcoOpen = useMemo(() => open.filter((i) => i.store === 'costco'), [open])

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

  function moveStore(item: ShoppingItem) {
    const store = item.store === 'costco' ? 'grocery' : 'costco'
    updateItem.mutate(
      { id: item.id, patch: { store } },
      { onError: () => toast('Could not move', { tone: 'error' }) },
    )
    // Remember for future adds of this item
    rememberItem.mutate({ name: item.name, patch: { store } })
    toast(`${item.name} → ${storeLabel(store)}`)
  }

  function setCategory(item: ShoppingItem, category: string | null) {
    updateItem.mutate(
      { id: item.id, patch: { category } },
      { onError: () => toast('Could not update', { tone: 'error' }) },
    )
    rememberItem.mutate({ name: item.name, patch: { category } })
  }

  const sectionHeaderCls =
    'flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase'

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col bg-canvas">
      <header className="glass sticky top-0 z-30 safe-t">
        <div className="px-4 pt-3 pb-2">
          <h1 className="text-[28px] font-bold tracking-tight">Shopping</h1>
        </div>
        <div className="flex px-4 pb-3">
          <div className="flex rounded-lg bg-card2 p-0.5">
            {(
              [
                { key: 'all' as const, label: 'All' },
                { key: 'grocery' as const, label: 'Grocery' },
                { key: 'costco' as const, label: 'Costco' },
              ]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setStoreFilter(f.key)}
                className={`pressable rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  storeFilter === f.key ? 'bg-card text-ink card-shadow' : 'text-ink2'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
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
            <p className="text-[17px] font-semibold">
              {storeFilter === 'costco' ? 'Nothing for Costco' : 'Nothing to buy'}
            </p>
            <p className="max-w-60 text-[14px] text-ink2">
              Tap + to add items, or send “to make” meals here from the planner.
            </p>
          </div>
        )}

        {/* Grocery aisles */}
        {storeFilter !== 'costco' &&
          grocerySections.sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-2">
              {!grocerySections.flat && <h2 className={sectionHeaderCls}>{section.label}</h2>}
              {section.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={() => setChecked.mutate({ id: item.id, checked: true })}
                  onMore={() => setItemActions(item)}
                />
              ))}
            </section>
          ))}

        {/* Costco run */}
        {storeFilter !== 'grocery' && costcoOpen.length > 0 && (
          <section className="flex flex-col gap-2">
            {storeFilter !== 'costco' && (
              <h2 className={`${sectionHeaderCls} mt-2`}>
                <Icon name="cart" size={14} /> Costco
              </h2>
            )}
            {costcoOpen.map((item) => (
              <Row
                key={item.id}
                item={item}
                onToggle={() => setChecked.mutate({ id: item.id, checked: true })}
                onMore={() => setItemActions(item)}
              />
            ))}
          </section>
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
                <Row
                  key={item.id}
                  item={item}
                  checked
                  onToggle={() => setChecked.mutate({ id: item.id, checked: false })}
                  onMore={() => setItemActions(item)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* FAB — consistent with the other tabs */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add items"
        className="pressable fixed right-5 bottom-[var(--bottom-clearance)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-tint text-white float-shadow"
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {addOpen && <AddItemsSheet onClose={() => setAddOpen(false)} />}

      {itemActions && (
        <ActionSheet
          title={itemActions.name}
          message={`${storeLabel(itemActions.store)} · ${categoryLabel(itemActions.category)}`}
          actions={[
            {
              label:
                itemActions.store === 'costco' ? 'Move to Grocery list' : 'Move to Costco list',
              onSelect: () => moveStore(itemActions),
            },
            { label: 'Change aisle…', onSelect: () => setCategoryPick(itemActions) },
            {
              label: 'Delete',
              tone: 'destructive',
              onSelect: () => deleteItem.mutate(itemActions.id),
            },
          ]}
          onClose={() => setItemActions(null)}
        />
      )}

      {categoryPick && (
        <ActionSheet
          title={`Aisle for ${categoryPick.name}`}
          actions={[
            ...CATEGORIES.map((c) => ({
              label: c.label,
              onSelect: () => setCategory(categoryPick, c.key),
            })),
            { label: 'Other', onSelect: () => setCategory(categoryPick, null) },
          ]}
          onClose={() => setCategoryPick(null)}
        />
      )}
    </div>
  )
}

function Row({
  item,
  checked = false,
  onToggle,
  onMore,
}: {
  item: ShoppingItem
  checked?: boolean
  onToggle: () => void
  onMore: () => void
}) {
  return (
    <div
      className={`pop-in flex items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow ${
        checked ? 'opacity-60' : ''
      }`}
    >
      {/* Check-off is a real button; the options button is a sibling. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${item.name} — ${checked ? 'checked, tap to uncheck' : 'tap to check off'}`}
        className="pressable flex min-w-0 flex-1 items-center gap-3 text-left"
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
      </button>
      <button
        onClick={onMore}
        aria-label={`Options for ${item.name}`}
        className="pressable hit flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
    </div>
  )
}
