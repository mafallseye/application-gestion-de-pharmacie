import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function buildClient() {
  if (!url || !key) return null
  try {
    return createClient(url, key)
  } catch {
    // URL mal formée dans le fichier .env : traité comme « non configuré ».
    return null
  }
}

// `supabase` vaut null tant que les variables d'environnement ne sont pas
// renseignées : l'interface doit tester `isSupabaseConfigured` avant tout.
export const supabase = buildClient()
export const isSupabaseConfigured = supabase !== null
