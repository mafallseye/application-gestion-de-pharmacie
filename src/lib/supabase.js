import { createClient } from '@supabase/supabase-js'
import { parseRecoveryUrl } from './recovery.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Adresse d'arrivée, lue AVANT la création du client : supabase-js consomme
// puis efface le fragment (#access_token… ou #error…) pendant son démarrage.
// { recovery, error } — voir lib/recovery.js.
export const arrival = parseRecoveryUrl(typeof window === 'undefined' ? {} : window.location)

// Options par défaut de supabase-js : flux implicite et détection de la session
// dans l'adresse (liens reçus par e-mail), session gardée dans le navigateur.
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
