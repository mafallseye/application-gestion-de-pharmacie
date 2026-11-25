import { useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { EmptyState } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import styles from './MobilePaymentReturnPage.module.css'

/**
 * Page publique affichée sur le téléphone du CLIENT après son paiement mobile
 * (?etat=ok ou ?etat=echec). Aucune donnée, aucun appel : la vente est validée
 * côté serveur, et c'est l'écran de la caisse qui fait foi.
 */
export default function MobilePaymentReturnPage() {
  const [params] = useSearchParams()
  const paid = params.get('etat') === 'ok'
  usePageTitle(paid ? 'Paiement reçu' : 'Paiement non abouti')
  return (
    <main className={styles.page}>
      {paid ? (
        <EmptyState icon={CircleCheck} title="Paiement reçu, merci." message="Vous pouvez retourner au comptoir." />
      ) : (
        <EmptyState
          icon={CircleAlert}
          title="Paiement non abouti"
          message="Aucun montant n’a été validé. Retournez au comptoir : le pharmacien vous proposera de réessayer ou un autre moyen de paiement."
        />
      )}
    </main>
  )
}
