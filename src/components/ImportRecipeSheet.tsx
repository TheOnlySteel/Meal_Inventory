import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Recipe } from '../lib/types'
import Sheet from './Sheet'

interface Imported {
  name: string
  ingredients: string
  instructions: string
  servings: number | null
  image_url: string | null
  source_url: string
  nutrition: Record<string, number | null>
}

interface Props {
  onClose: () => void
  /** Opens the recipe form prefilled; imageUrl is fetched after first save. */
  onImported: (template: Partial<Recipe>, imageUrl: string | null) => void
}

/** Paste a recipe URL; the import-recipe edge function reads its JSON-LD. */
export default function ImportRecipeSheet({ onClose, onImported }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent, close: () => void) {
    e.preventDefault()
    if (busy || !url.trim()) return
    setBusy(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke<Imported>('import-recipe', {
      body: { url: url.trim() },
    })
    if (fnError || !data) {
      // FunctionsHttpError carries the function's JSON error body
      let message = 'Import failed — check the link and try again'
      if (fnError && 'context' in fnError) {
        try {
          const body = await (fnError.context as Response).json()
          if (body?.error) message = body.error
        } catch {
          /* keep default */
        }
      }
      setError(message)
      setBusy(false)
      return
    }
    const n = data.nutrition ?? {}
    onImported(
      {
        name: data.name,
        ingredients: data.ingredients,
        instructions: data.instructions,
        servings_per_pack: data.servings ?? 1,
        notes: `Source: ${data.source_url}`,
        calories: n.calories ?? null,
        protein_g: n.protein_g ?? null,
        fat_g: n.fat_g ?? null,
        carbs_g: n.carbs_g ?? null,
        fibre_g: n.fibre_g ?? null,
        sugar_g: n.sugar_g ?? null,
        sat_fat_g: n.sat_fat_g ?? null,
        sodium_mg: n.sodium_mg ?? null,
      },
      data.image_url,
    )
    close()
  }

  return (
    <Sheet
      onClose={onClose}
      ariaLabel="Import recipe from URL"
      panelClassName="flex w-full max-w-lg flex-col rounded-t-3xl bg-elevated float-shadow sm:rounded-3xl"
    >
      {(close) => (
        <form onSubmit={(e) => submit(e, close)} className="flex flex-col gap-3 p-5 pb-8 safe-b">
          <div className="flex items-center justify-between">
            <button type="button" onClick={close} className="pressable text-[16px] text-tint">
              Cancel
            </button>
            <h2 className="text-[16px] font-semibold">Import from the web</h2>
            <button
              type="submit"
              disabled={!url.trim() || busy}
              className="pressable text-[16px] font-semibold text-tint disabled:opacity-40"
            >
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
          <p className="text-[13px] text-ink2">
            Paste a link to any recipe page — name, ingredients, steps, and nutrition come along
            when the site provides them.
          </p>
          <input
            type="url"
            inputMode="url"
            value={url}
            data-autofocus
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-sep bg-elevated px-4 py-3 text-[16px] outline-none transition-shadow focus:ring-2 focus:ring-tint/60"
          />
          {error && (
            <p role="alert" className="text-[13px]" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}
        </form>
      )}
    </Sheet>
  )
}
