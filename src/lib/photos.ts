import { supabase } from './supabase'

/** Public URL for a recipe-photos storage path (bucket is public; paths are uuid-namespaced). */
export function recipePhotoUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from('recipe-photos').getPublicUrl(path).data.publicUrl
}

/** Upload a photo for a recipe; returns the storage path to save on the row. */
export async function uploadRecipePhoto(
  householdId: string,
  recipeId: string,
  file: Blob,
): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${householdId}/${recipeId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('recipe-photos').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error
  return path
}

/** Best-effort fetch of an imported recipe's photo (CORS may block; callers ignore null). */
export async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return blob.type.startsWith('image/') ? blob : null
  } catch {
    return null
  }
}
