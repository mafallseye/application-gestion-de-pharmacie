// Paiement d'une vente par mobile money : machine d'état de l'attente et libellés (pur).
//
// Phases : 'waiting' (on interroge le serveur régulièrement), 'error' (pause :
// l'utilisateur relance), puis une phase finale dont on ne sort plus —
// 'completed', 'cancelled', 'sale_cancelled', 'review', 'unknown'.

const FINAL = new Set(['completed', 'cancelled', 'sale_cancelled', 'review', 'unknown'])

export const INITIAL_MOBILE_PAYMENT = { phase: 'waiting', checks: 0, error: null }

export function isFinalPhase(phase) {
  return FINAL.has(phase)
}

/**
 * Événements :
 *  - { type: 'status', status } : réponse du serveur (verify ou cancel) ;
 *  - { type: 'failure', message } : l'appel lui-même a échoué (réseau, 5xx) ;
 *  - { type: 'retry' } : l'utilisateur relance après une erreur.
 * `checks` compte les réponses reçues : il sert à réarmer la vérification suivante.
 */
export function mobilePaymentReducer(state, event) {
  // Un état final est définitif : une réponse tardive ne le change plus.
  if (isFinalPhase(state.phase)) return state
  const checks = state.checks + 1
  switch (event.type) {
    case 'status':
      if (FINAL.has(event.status)) return { phase: event.status, checks, error: null }
      if (event.status === 'pending') return { phase: 'waiting', checks, error: null }
      // 'error' ou statut inattendu : on s'arrête et on laisse l'utilisateur relancer.
      return { phase: 'error', checks, error: null }
    case 'failure':
      return { phase: 'error', checks, error: event.message ?? null }
    case 'retry':
      return state.phase === 'error' ? { phase: 'waiting', checks, error: null } : state
    default:
      return state
  }
}

/**
 * Message d'une phase : { tone, title, message }. `wholeSale` : la demande
 * portait sur une vente « mobile » jamais payée (et non sur un reste à payer).
 * Un paiement « review » a été reçu : on ne dit jamais qu'il a échoué.
 */
export function mobilePaymentOutcome(phase, { wholeSale = true, error = null } = {}) {
  switch (phase) {
    case 'waiting':
      return {
        tone: 'info',
        title: 'En attente du paiement du client…',
        message: 'Le client scanne le code avec son téléphone et valide dans Wave ou Orange Money.',
      }
    case 'completed':
      return { tone: 'success', title: 'Paiement reçu', message: wholeSale ? 'La vente est payée.' : 'Le paiement a été ajouté à la vente.' }
    case 'sale_cancelled':
      return { tone: 'info', title: 'Vente annulée', message: 'Le paiement n’a pas eu lieu : la vente est annulée et le stock a été rendu.' }
    case 'cancelled':
      return { tone: 'info', title: 'Demande de paiement annulée', message: 'Aucun montant n’a été encaissé par mobile money.' }
    case 'review':
      return {
        tone: 'info',
        title: 'Paiement reçu, en cours de contrôle',
        message:
          'Le client a payé, mais le montant n’a pas pu être rattaché à la vente. Un contrôle manuel est nécessaire : prévenez l’administrateur de la pharmacie.',
      }
    case 'unknown':
      return { tone: 'danger', title: 'Paiement introuvable', message: 'Cette demande de paiement n’existe plus. Rechargez la vente.' }
    default:
      return {
        tone: 'warning',
        title: 'Vérification impossible pour le moment',
        message: error ?? 'L’état du paiement n’a pas pu être vérifié. Réessayez dans un instant.',
      }
  }
}

const METHODS = { cash: 'Espèces', mobile: 'Mobile money' }

/** Mode d'un paiement enregistré (`payments.method`). */
export function paymentMethodLabel(method) {
  return METHODS[method] ?? 'Espèces'
}

/** Demande de paiement mobile en attente d'une vente (lue avec `mobile_payments`), ou null. */
export function pendingMobilePayment(sale) {
  return sale?.mobile_payments?.find((payment) => payment.status === 'pending') ?? null
}
