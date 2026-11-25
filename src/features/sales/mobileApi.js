// Paiement des ventes par mobile money : appels à la fonction Edge `sale-payments`
// (elle seule détient la clé NabooPay de la pharmacie).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { functionError, unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'
import { changesSale, mobilePaymentsToRecheck } from './mobilePayment.js'

async function salePayments(body) {
  const { data, error } = await supabase.functions.invoke('sale-payments', { body })
  if (error) throw await functionError(error)
  return data
}

/** Réglage de la pharmacie (admin) : { configured, has_webhook_secret, webhook_url }. Les clés ne sont jamais renvoyées. */
export function getMobileSettings() {
  return salePayments({ action: 'settings_get' })
}

/** Enregistre la clé NabooPay (essayée par le serveur avant d'être gardée) et, si fournie, la clé du webhook. */
export function saveMobileSettings({ apiKey, webhookSecret }) {
  return salePayments({ action: 'settings_save', api_key: apiKey, webhook_secret: webhookSecret || undefined })
}

export function clearMobileSettings() {
  return salePayments({ action: 'settings_clear' })
}

/**
 * Ouvre (ou retrouve) la demande de paiement mobile d'une vente :
 * { payment_id, order_id, url, amount }. `amount` par défaut : le reste à payer.
 */
export function startMobilePayment({ saleId, amount }) {
  return salePayments({ action: 'start', sale_id: saleId, amount })
}

/** État d'une demande auprès de NabooPay : completed | pending | cancelled | sale_cancelled | review | error | unknown. */
export async function verifyMobilePayment(orderId) {
  const { status } = await salePayments({ action: 'verify', order_id: orderId })
  return status
}

/** Abandonne une demande en attente ; renvoie le même jeu de statuts (« completed » si le client a payé entre-temps). */
export async function cancelMobilePayment(paymentId) {
  const { status } = await salePayments({ action: 'cancel', payment_id: paymentId })
  return status
}

export function useMobileSettings() {
  return useQuery({ queryKey: queryKeys.mobileSettings, queryFn: getMobileSettings })
}

// Après un changement de réglage, la pharmacie (mobile_money_enabled) est rechargée.
function useSettingsMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => invalidate(queryClient, ['profile'], queryKeys.mobileSettings) })
}

export function useSaveMobileSettings() {
  return useSettingsMutation(saveMobileSettings)
}

export function useClearMobileSettings() {
  return useSettingsMutation(clearMobileSettings)
}

export function useStartMobilePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startMobilePayment,
    // Un refus du prestataire peut annuler la vente « mobile » et rendre le stock.
    onSettled: () => invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard),
  })
}

export function useCancelMobilePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelMobilePayment,
    onSettled: () => invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard),
  })
}

/** Demandes de paiement mobile en attente de la pharmacie (les plus récentes d'abord). */
export async function listPendingMobilePayments() {
  return unwrap(
    await supabase
      .from('sale_mobile_payments')
      .select('id,sale_id,status,order_id,created_at')
      .eq('status', 'pending')
      .not('order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
  )
}

/**
 * Rattrapage sans notification du prestataire : à l'ouverture de la liste des
 * ventes, chaque demande en attente récente est revérifiée une fois, l'une
 * après l'autre (ni boucle, ni appels en parallèle). Les ventes ne sont
 * rechargées que si un paiement a changé d'état. Les échecs sont silencieux :
 * la vérification reste possible depuis le détail de la vente.
 */
export function useMobilePaymentCatchUp() {
  const queryClient = useQueryClient()
  const pending = useQuery({ queryKey: queryKeys.pendingMobilePayments, queryFn: listPendingMobilePayments })
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !pending.data) return
    done.current = true
    const run = async () => {
      let changed = false
      for (const payment of mobilePaymentsToRecheck(pending.data)) {
        const status = await verifyMobilePayment(payment.order_id).catch(() => null)
        if (changesSale(status)) changed = true
      }
      if (changed) invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard)
    }
    run()
  }, [pending.data, queryClient])
}
