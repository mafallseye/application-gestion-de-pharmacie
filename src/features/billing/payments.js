// Paiements d'abonnement : libellés par statut et choix des paiements à revérifier (pur).

const RECHECK_WINDOW_MS = 48 * 60 * 60 * 1000

/** Badge d'un paiement dans l'historique, selon son statut en base. */
const BADGES = {
  completed: { tone: 'success', label: 'Payé' },
  pending: { tone: 'warning', label: 'En attente' },
  review: { tone: 'info', label: 'À vérifier' },
  cancelled: { tone: 'neutral', label: 'Annulé' },
  failed: { tone: 'danger', label: 'Échoué' },
}

export function paymentBadge(status) {
  return BADGES[status] ?? { tone: 'neutral', label: 'Inconnu' }
}

/**
 * Message à afficher après une vérification (réponse `status` de la fonction
 * `billing`) : { tone, title, message, retry }. `retry` : proposer de revérifier.
 * Un paiement « review » a été reçu : on ne dit jamais qu'il a échoué.
 */
const OUTCOMES = {
  completed: { tone: 'success', title: 'Paiement reçu, merci !', message: 'Votre abonnement a été prolongé.', retry: false },
  pending: {
    tone: 'warning',
    title: 'Paiement en attente de confirmation',
    message: 'La confirmation peut prendre quelques minutes. Votre abonnement sera prolongé dès qu’elle arrivera.',
    retry: true,
  },
  review: {
    tone: 'info',
    title: 'Paiement reçu, en cours de contrôle',
    message:
      'Paiement reçu. Sa validation demande une vérification manuelle : contactez le support, votre abonnement sera activé après contrôle.',
    retry: false,
  },
  error: {
    tone: 'warning',
    title: 'Vérification impossible pour le moment',
    message: 'La vérification est momentanément impossible. Réessayez dans un instant.',
    retry: true,
  },
  cancelled: { tone: 'info', title: 'Paiement annulé', message: 'Aucun montant n’a été débité.', retry: false },
  failed: {
    tone: 'danger',
    title: 'Le paiement a échoué',
    message: 'Aucun abonnement n’a été enregistré. Vous pouvez relancer un paiement.',
    retry: false,
  },
}
const UNKNOWN = {
  tone: 'danger',
  title: 'Paiement introuvable',
  message: 'Cette référence de paiement ne correspond à aucun paiement de votre pharmacie.',
  retry: false,
}

export function paymentOutcome(status) {
  return OUTCOMES[status] ?? UNKNOWN
}

/** Un paiement en attente peut être revérifié auprès de PayDunya s'il a une référence. */
export function canVerify(payment) {
  return payment.status === 'pending' && Boolean(payment.provider_token)
}

/**
 * Paiements à revérifier d'office à l'ouverture de la page : en attente, avec
 * une référence, créés depuis moins de 48 h (un client débité qui a fermé
 * l'onglet avant le retour doit voir son paiement validé sans rien faire).
 */
export function paymentsToRecheck(payments, now = new Date()) {
  return (payments ?? []).filter(
    (payment) => canVerify(payment) && now.getTime() - Date.parse(payment.created_at) < RECHECK_WINDOW_MS,
  )
}
