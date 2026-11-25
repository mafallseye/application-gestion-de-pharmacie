import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { Alert, Button, Spinner, useToast } from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'
import { formatMoney } from '../../lib/format.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { cancelMobilePayment, verifyMobilePayment } from './mobileApi.js'
import { INITIAL_MOBILE_PAYMENT, isFinalPhase, mobilePaymentOutcome, mobilePaymentReducer } from './mobilePayment.js'
import styles from './MobilePaymentPanel.module.css'

const POLL_MS = 4500

/** QR code de l'adresse de paiement, généré dans le navigateur (aucun service externe). */
function QrCode({ value }) {
  const [image, setImage] = useState(null)
  useEffect(() => {
    let current = true
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(value, { width: 480, margin: 2, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => current && setImage(dataUrl))
      .catch(() => current && setImage(false))
    return () => {
      current = false
    }
  }, [value])

  if (image === false) return <p className={styles.qrFallback}>Le code QR n’a pas pu être généré : utilisez le lien ci-dessous.</p>
  // Fond toujours blanc, même en thème sombre : le code doit rester lisible par un téléphone.
  return (
    <div className={styles.qr}>
      {image ? <img src={image} alt="Code QR à scanner par le client pour payer" width="184" height="184" /> : <Spinner size={28} />}
    </div>
  )
}

/**
 * Attente d'un paiement mobile : QR code, lien, montant, et suivi de l'état.
 * Le serveur est interrogé toutes les 4,5 s tant que le paiement est en attente ;
 * un seul appel à la fois, plus aucun après un état final ou la fermeture.
 * Props :
 *  - payment : { payment_id, order_id, url, amount }
 *  - saleNumber, wholeSale (vente « mobile » jamais payée : l'annuler annule la vente)
 *  - onFinal(phase) : appelé une fois, à l'arrivée d'un état final
 *  - onPhase?(phase) : suivi de la phase courante (ex. bloquer la fermeture d'une modale)
 */
export function MobilePaymentPanel({ payment, saleNumber, wholeSale = true, onFinal, onPhase }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(mobilePaymentReducer, INITIAL_MOBILE_PAYMENT)
  const [busy, setBusy] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Un seul appel au serveur à la fois (vérification automatique, manuelle ou annulation).
  const ask = useCallback(async (call) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const status = await call()
      if (mounted.current) dispatch({ type: 'status', status })
    } catch (error) {
      if (mounted.current) dispatch({ type: 'failure', message: errorMessage(error) })
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }, [])

  const verify = useCallback(() => ask(() => verifyMobilePayment(payment.order_id)), [ask, payment.order_id])

  // Vérification automatique : réarmée après chaque réponse « en attente ».
  useEffect(() => {
    if (state.phase !== 'waiting') return undefined
    const timer = setTimeout(verify, POLL_MS)
    return () => clearTimeout(timer)
  }, [state.phase, state.checks, verify])

  // État final : on prévient le parent une fois, puis ventes et stock sont rechargés.
  const { phase } = state
  const notified = useRef(false)
  useEffect(() => {
    onPhase?.(phase)
    if (!isFinalPhase(phase) || notified.current) return
    notified.current = true
    onFinal?.(phase)
    invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard)
  }, [phase, onFinal, onPhase, queryClient])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payment.url)
      toast.success('Lien de paiement copié.')
    } catch {
      toast.error('Copie impossible : sélectionnez le lien et copiez-le à la main.')
    }
  }

  const outcome = mobilePaymentOutcome(phase, { wholeSale, error: state.error })
  const final = isFinalPhase(phase)

  return (
    <div className={styles.panel}>
      <div className={styles.amount}>
        <span>Vente n° {saleNumber}</span>
        <strong data-numeric>{formatMoney(payment.amount)}</strong>
      </div>

      {final ? null : (
        <>
          <QrCode value={payment.url} />
          <div className={styles.link}>
            {/* Texte (et non champ) : dans une modale, le focus doit aller au bouton « Vérifier maintenant ». */}
            <span className={styles.linkText} title={payment.url}>
              <span className="sr-only">Lien de paiement : </span>
              {payment.url}
            </span>
            <Button size="sm" variant="secondary" icon={Copy} onClick={copyLink}>
              Copier
            </Button>
            <Button as="a" href={payment.url} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost" icon={ExternalLink}>
              Ouvrir
            </Button>
          </div>
        </>
      )}

      <Alert tone={outcome.tone} title={outcome.title}>
        {outcome.message}
      </Alert>

      {final ? null : confirmingCancel ? (
        <div className={styles.confirm} role="group" aria-label="Confirmer l’annulation">
          <p>
            {wholeSale
              ? 'Annuler cette vente ? Le stock sera rendu. Si le client a déjà payé, la vente sera au contraire validée.'
              : 'Annuler cette demande de paiement ? Si le client a déjà payé, le paiement sera au contraire enregistré.'}
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={busy}>
              {wholeSale ? 'Conserver la vente' : 'Conserver la demande'}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await ask(() => cancelMobilePayment(payment.payment_id))
                if (mounted.current) setConfirmingCancel(false)
              }}
            >
              {wholeSale ? 'Oui, annuler la vente' : 'Oui, annuler la demande'}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={busy}>
            {wholeSale ? 'Annuler la vente' : 'Annuler la demande'}
          </Button>
          {phase === 'error' ? (
            <Button icon={RefreshCw} onClick={() => dispatch({ type: 'retry' })}>
              Réessayer
            </Button>
          ) : (
            // data-autofocus : dans une modale, le focus va ici plutôt que sur le champ du lien.
            <Button icon={RefreshCw} loading={busy} onClick={verify} data-autofocus>
              Vérifier maintenant
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
