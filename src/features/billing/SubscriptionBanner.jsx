import { Link } from 'react-router-dom'
import { Alert, Button } from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { formatDate } from '../../lib/format.js'
import shared from '../shared/shared.module.css'

const SUBSCRIBE = (label) => (
  <Button as={Link} to="/abonnement" variant="secondary" size="sm">
    {label}
  </Button>
)

/**
 * Bandeau affiché en haut de toutes les pages : accès expiré (lecture seule,
 * pour tout le monde) ou fin d'accès proche (administrateur seulement).
 */
export function SubscriptionBanner() {
  const { subscription, isAdmin } = useAuth()

  if (!subscription.canWrite) {
    return (
      <Alert
        tone="danger"
        title="Abonnement expiré : l’application est en lecture seule"
        className={shared.pageAlert}
        action={isAdmin ? SUBSCRIBE('Renouveler') : null}
      >
        {isAdmin
          ? 'Vos données restent consultables. Renouvelez l’abonnement pour enregistrer de nouveau des ventes et modifier le stock.'
          : 'Vos données restent consultables. Contactez votre administrateur pour renouveler l’abonnement.'}
      </Alert>
    )
  }

  if (isAdmin && subscription.endingSoon) {
    const what = subscription.status === 'trial' ? 'La période d’essai' : 'L’abonnement'
    const days = subscription.daysLeft > 1 ? `dans ${subscription.daysLeft} jours` : 'dans moins de 24 heures'
    return (
      <Alert tone="warning" className={shared.pageAlert} action={SUBSCRIBE(subscription.status === 'trial' ? 'S’abonner' : 'Renouveler')}>
        {what} se termine {days} (le {formatDate(subscription.endsAt)}). Ensuite, l’application passera en lecture seule.
      </Alert>
    )
  }

  return null
}
