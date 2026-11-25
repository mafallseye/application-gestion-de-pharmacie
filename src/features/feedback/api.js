import { useMutation } from '@tanstack/react-query'
import { unwrap } from '../../lib/errors.js'
import { supabase } from '../../lib/supabase.js'

/**
 * Dépose un avis : { rating (1 à 5), message, missing }. La table n'est pas
 * lisible par l'application : insertion seule, sans relire la ligne. La
 * pharmacie et l'auteur sont posés par la base.
 */
export async function sendFeedback({ rating, message, missing }) {
  unwrap(await supabase.from('feedback').insert({ rating, message, missing }))
}

export function useSendFeedback() {
  return useMutation({ mutationFn: sendFeedback })
}
