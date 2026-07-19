// Import a recipe from a URL by reading its schema.org/Recipe JSON-LD.
// Virtually every recipe site embeds one for search engines; we map it to
// the app's recipe shape and let the user review before saving.
//
// Deploy: supabase functions deploy import-recipe
// Invoked from the app via supabase.functions.invoke('import-recipe', { body: { url } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// deno-lint-ignore no-explicit-any
type Json = any

/** Depth-first search for the first @type Recipe node (handles @graph and arrays). */
function findRecipe(node: Json): Json | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item)
      if (found) return found
    }
    return null
  }
  const type = node['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) return node
  if (node['@graph']) return findRecipe(node['@graph'])
  return null
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, '')).trim()

function asText(v: Json): string {
  if (v == null) return ''
  if (typeof v === 'string') return stripTags(v)
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join('\n')
  if (typeof v === 'object') return asText(v.text ?? v.name ?? '')
  return String(v)
}

/** Instructions can be strings, HowToSteps, or HowToSections with itemListElement. */
function instructionsText(v: Json): string {
  if (v == null) return ''
  if (typeof v === 'string') return stripTags(v)
  if (Array.isArray(v)) return v.map(instructionsText).filter(Boolean).join('\n')
  if (typeof v === 'object') {
    if (v.itemListElement) {
      const section = asText(v.name)
      const steps = instructionsText(v.itemListElement)
      return section ? `${section}:\n${steps}` : steps
    }
    return asText(v.text ?? v.name ?? '')
  }
  return ''
}

/** "240 calories" / "4 g" / "1200 mg" → leading number, or null. */
function num(v: Json): number | null {
  if (v == null) return null
  const m = String(v).replace(',', '.').match(/\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function firstImage(v: Json): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return firstImage(v[0])
  if (typeof v === 'object') return firstImage(v.url ?? v.contentUrl ?? null)
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let url: string
  try {
    const body = await req.json()
    url = String(body.url ?? '')
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return json({ error: 'Only http(s) URLs are supported' }, 400)
  }

  let html: string
  try {
    const res = await fetch(parsed.href, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        // Some sites gate JSON-LD behind a browser-looking UA
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html',
      },
    })
    if (!res.ok) return json({ error: `Site responded ${res.status}` }, 422)
    html = await res.text()
  } catch {
    return json({ error: 'Could not reach that site' }, 422)
  }

  // Pull every JSON-LD block and look for a Recipe node
  let recipe: Json = null
  const blocks = html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const [, raw] of blocks) {
    try {
      recipe = findRecipe(JSON.parse(raw.trim()))
    } catch {
      // malformed block — some sites ship trailing commas; try a light cleanup
      try {
        recipe = findRecipe(JSON.parse(raw.trim().replace(/,\s*([}\]])/g, '$1')))
      } catch {
        recipe = null
      }
    }
    if (recipe) break
  }

  if (!recipe) {
    return json({ error: 'No recipe data found on that page' }, 422)
  }

  const n = recipe.nutrition ?? {}
  const ingredients = (
    Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient
      : [recipe.recipeIngredient]
  )
    .filter(Boolean)
    .map((line: Json) => asText(line))
    .join('\n')

  return json({
    name: asText(recipe.name),
    ingredients,
    instructions: instructionsText(recipe.recipeInstructions),
    servings: num(recipe.recipeYield),
    image_url: firstImage(recipe.image),
    source_url: parsed.href,
    nutrition: {
      calories: num(n.calories),
      protein_g: num(n.proteinContent),
      fat_g: num(n.fatContent),
      carbs_g: num(n.carbohydrateContent),
      fibre_g: num(n.fiberContent),
      sugar_g: num(n.sugarContent),
      sat_fat_g: num(n.saturatedFatContent),
      sodium_mg: num(n.sodiumContent),
    },
  })
})
