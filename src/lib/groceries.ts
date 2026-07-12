// Shopping helpers: store/aisle constants and quantity parsing shared by the
// list, the rapid-add sheet, and recipe-ingredient sends.

export const STORES = [
  { key: 'grocery', label: 'Grocery' },
  { key: 'costco', label: 'Costco' },
] as const

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'produce', label: 'Produce' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'dairy', label: 'Dairy & Eggs' },
  { key: 'meat', label: 'Meat & Fish' },
  { key: 'frozen', label: 'Frozen' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'household', label: 'Household' },
]

export function categoryLabel(key: string | null): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? 'Other'
}

export function storeLabel(key: string): string {
  return STORES.find((s) => s.key === key)?.label ?? key
}

/** Canonical catalog key for an item name. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

const UNIT = String.raw`(?:l|ml|kg|g|lb|lbs|oz|pk|pack|packs|cans?|bottles?|dozen)`

/** Split "2 milk", "3x eggs", "500g flour" or "milk 2l" into name + quantity. */
export function parseItemInput(raw: string): { name: string; quantity: string | null } {
  const s = raw.trim().replace(/\s+/g, ' ')
  let m = s.match(new RegExp(String.raw`^(\d+(?:[.,]\d+)?\s*${UNIT})\s+(.+)$`, 'i'))
  if (m) return { name: m[2], quantity: m[1] }
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(.+)$/i)
  if (m) return { name: m[2], quantity: m[1] }
  m = s.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/)
  if (m) return { name: m[2], quantity: m[1] }
  m = s.match(new RegExp(String.raw`^(.+?)\s+(\d+(?:[.,]\d+)?\s*${UNIT})$`, 'i'))
  if (m) return { name: m[1], quantity: m[2] }
  return { name: s, quantity: null }
}

/** Sum two quantity strings when both are bare counts ("2" + "1" = "3"); null = can't merge. */
export function mergeQuantities(a: string | null, b: string | null): string | null {
  const toCount = (q: string | null) =>
    q == null ? 1 : /^\d+(?:[.,]\d+)?$/.test(q) ? parseFloat(q.replace(',', '.')) : NaN
  const sum = toCount(a) + toCount(b)
  if (Number.isNaN(sum)) return null
  return String(Number.isInteger(sum) ? sum : sum.toFixed(1))
}
