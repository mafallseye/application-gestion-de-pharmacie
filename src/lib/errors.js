// Traduction des erreurs Supabase / Postgres en messages français lisibles.
// Règle : aucun message technique brut ne doit atteindre l'utilisateur.

const GENERIC = 'Une erreur est survenue. Réessayez.'
const NETWORK = 'Connexion au serveur impossible. Vérifiez votre connexion internet et réessayez.'
const FORBIDDEN = "Vous n'avez pas les droits nécessaires pour cette action."
const SESSION = 'Votre session a expiré. Reconnectez-vous.'
const INVALID = 'Certaines valeurs ne sont pas valides. Vérifiez le formulaire.'
const RATE_LIMIT = 'Trop de tentatives. Patientez quelques instants avant de réessayer.'
const UNAVAILABLE = 'Le service est momentanément indisponible. Réessayez plus tard.'
export const NO_ROW = "Action impossible : l'élément est introuvable ou vous n'avez pas les droits nécessaires."

// Erreurs Postgres / PostgREST identifiées par leur code.
const BY_CODE = {
  23505: 'Cet élément existe déjà.',
  23503: "Opération impossible : un élément lié n'existe plus ou est encore utilisé.",
  23502: INVALID,
  23514: INVALID,
  '22P02': INVALID,
  22003: INVALID,
  22001: INVALID,
  PGRST116: NO_ROW,
  PGRST301: SESSION,
  PGRST303: SESSION,
}

// Erreurs du service d'authentification (champ `code` de supabase-js).
const BY_AUTH_CODE = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  email_not_confirmed: "Cette adresse e-mail n'a pas encore été confirmée.",
  user_banned: 'Ce compte est bloqué. Contactez un administrateur.',
  over_request_rate_limit: RATE_LIMIT,
  session_expired: SESSION,
  session_not_found: SESSION,
  refresh_token_not_found: SESSION,
  refresh_token_already_used: SESSION,
  bad_jwt: SESSION,
  user_already_exists: 'Cette adresse e-mail est déjà utilisée. Connectez-vous, ou choisissez une autre adresse.',
  email_exists: 'Cette adresse e-mail est déjà utilisée. Connectez-vous, ou choisissez une autre adresse.',
  signup_disabled: "Les inscriptions sont fermées pour le moment.",
  email_address_invalid: "Cette adresse e-mail n'est pas acceptée. Vérifiez-la ou utilisez-en une autre.",
  over_email_send_rate_limit: 'Trop de demandes. Réessayez dans quelques minutes.',
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  weak_password: 'Ce mot de passe est trop faible. Choisissez-en un plus long ou moins courant.',
  reauthentication_needed: 'Pour changer de mot de passe, déconnectez-vous puis reconnectez-vous, et réessayez.',
}

// Codes utilisés par les `raise exception` du schéma : leur message est déjà
// rédigé en français pour l'utilisateur (ex. « Stock insuffisant pour … »).
const BUSINESS_CODES = new Set(['22023', 'P0001', '42501'])
const NATIVE_DENIED = /permission denied|row-level security/i
const NETWORK_PATTERN = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i
const NETWORK_NAMES = new Set(['AuthRetryableFetchError', 'FunctionsFetchError'])

export class AppError extends Error {
  constructor(message, { code = null, retryable = false, cause } = {}) {
    super(message, { cause })
    this.name = 'AppError'
    this.code = code
    // Vrai pour une panne réseau ou serveur : la requête peut être retentée.
    this.retryable = retryable
  }
}

function isNetworkError(error) {
  return NETWORK_NAMES.has(error?.name) || NETWORK_PATTERN.test(error?.message ?? '')
}

function isServerError(error) {
  return typeof error?.status === 'number' && error.status >= 500
}

/**
 * Message français pour n'importe quelle erreur.
 * `overrides` remplace le message d'un code précis,
 * ex. { 23505: 'Une catégorie porte déjà ce nom.' }.
 */
export function errorMessage(error, overrides = {}) {
  if (error instanceof AppError) return error.message
  if (!error) return GENERIC

  const code = error.code == null ? '' : String(error.code)
  const message = typeof error.message === 'string' ? error.message : ''

  if (code && overrides[code]) return overrides[code]
  if (isNetworkError(error)) return NETWORK
  if (BY_AUTH_CODE[code]) return BY_AUTH_CODE[code]
  if (/invalid login credentials/i.test(message)) return BY_AUTH_CODE.invalid_credentials
  if (BY_CODE[code]) return BY_CODE[code]
  if (code === '42501' && (!message || NATIVE_DENIED.test(message))) return FORBIDDEN
  if (BUSINESS_CODES.has(code) && message) return message
  if (/jwt expired/i.test(message)) return SESSION
  if (error.status === 429) return RATE_LIMIT
  if (error.status === 401) return SESSION
  if (error.status === 403) return FORBIDDEN
  if (isServerError(error)) return UNAVAILABLE
  return GENERIC
}

export function toAppError(error, overrides) {
  if (error instanceof AppError) return error
  return new AppError(errorMessage(error, overrides), {
    code: error?.code == null ? null : String(error.code),
    retryable: isNetworkError(error) || isServerError(error),
    cause: error,
  })
}

/** Déballe une réponse supabase-js `{ data, error }` : renvoie data ou lève une AppError. */
export function unwrap({ data, error }, overrides) {
  if (error) throw toAppError(error, overrides)
  return data
}

/**
 * Erreur renvoyée par `supabase.functions.invoke`. Pour une erreur HTTP, la
 * fonction Edge place un message lisible dans le JSON `{ error }` de la réponse
 * (accessible via `error.context`).
 */
export async function functionError(error) {
  const response = error?.context
  if (error?.name !== 'FunctionsHttpError' || typeof response?.json !== 'function') {
    return toAppError(error)
  }
  let body = null
  try {
    body = await response.json()
  } catch {
    // Réponse non JSON (ex. erreur de la passerelle) : message selon le statut.
  }
  const status = response.status
  if (typeof body?.error === 'string' && body.error.trim()) {
    return new AppError(body.error.trim(), { code: String(status), cause: error })
  }
  if (status === 404) return new AppError(UNAVAILABLE, { code: '404', cause: error })
  return toAppError({ status, message: '' })
}
