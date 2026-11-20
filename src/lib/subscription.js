// État de l'abonnement d'une pharmacie (pur). Même règle que la fonction SQL
// private.can_write() : l'accès court jusqu'à la plus tardive des deux dates
// (fin de l'essai, fin de l'abonnement) ; au-delà, lecture seule.

const DAY_MS = 24 * 60 * 60 * 1000
export const ENDING_SOON_DAYS = 5

/**
 * pharmacy : { trial_ends_at, subscription_ends_at } (dates ISO) ou null.
 * Renvoie { status: 'trial' | 'active' | 'expired', endsAt (Date ou null),
 * daysLeft (jours entamés restants, 0 si expiré), canWrite, endingSoon }.
 */
export function subscriptionState(pharmacy, now = new Date()) {
  const trialEnd = Date.parse(pharmacy?.trial_ends_at ?? '')
  const paidEnd = Date.parse(pharmacy?.subscription_ends_at ?? '')
  const ends = [trialEnd, paidEnd].filter((time) => !Number.isNaN(time))
  if (ends.length === 0) {
    return { status: 'expired', endsAt: null, daysLeft: 0, canWrite: false, endingSoon: false }
  }
  const end = Math.max(...ends)
  const canWrite = end > now.getTime()
  const daysLeft = canWrite ? Math.ceil((end - now.getTime()) / DAY_MS) : 0
  // « Abonné » dès qu'un abonnement payé prolonge l'accès au-delà de l'essai.
  const paid = !Number.isNaN(paidEnd) && paidEnd === end
  return {
    status: canWrite ? (paid ? 'active' : 'trial') : 'expired',
    endsAt: new Date(end),
    daysLeft,
    canWrite,
    endingSoon: canWrite && daysLeft <= ENDING_SOON_DAYS,
  }
}
