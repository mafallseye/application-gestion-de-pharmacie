// Arrivée depuis un lien « mot de passe oublié » : lecture de l'adresse (pur).
//
// Le client Supabase utilise le flux implicite : le lien de l'e-mail ramène sur
//   /nouveau-mot-de-passe#access_token=…&refresh_token=…&type=recovery
// ou, si le lien est expiré ou déjà utilisé, sur
//   /nouveau-mot-de-passe#error=access_denied&error_code=otp_expired&error_description=…
// (les mêmes paramètres peuvent arriver après « ? » selon le réglage du projet).

function params(text) {
  return new URLSearchParams(String(text ?? '').replace(/^[#?]/, ''))
}

/**
 * { hash, search } de l'adresse d'arrivée → { recovery, error }.
 *  - recovery : vrai si l'adresse porte un jeton de récupération (ou un code PKCE de récupération) ;
 *  - error : null, ou 'expired' (lien expiré, invalide ou déjà utilisé), ou 'other'.
 */
export function parseRecoveryUrl({ hash = '', search = '' } = {}) {
  const fromHash = params(hash)
  const fromSearch = params(search)
  const get = (name) => fromHash.get(name) ?? fromSearch.get(name)

  const errorCode = get('error_code')
  const failed = Boolean(get('error') || errorCode || get('error_description'))
  const error = !failed ? null : errorCode === 'otp_expired' || get('error') === 'access_denied' ? 'expired' : 'other'
  const recovery = !failed && get('type') === 'recovery' && Boolean(get('access_token') || get('code'))
  return { recovery, error }
}
