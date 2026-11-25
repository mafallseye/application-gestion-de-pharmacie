// Paiement des ventes par mobile money : appels à la fonction Edge `sale-payments`
// (elle seule détient la clé NabooPay de la pharmacie).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { functionError } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

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
