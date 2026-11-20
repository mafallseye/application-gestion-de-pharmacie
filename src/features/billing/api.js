import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { saveRow } from '../../lib/crud.js'
import { functionError, unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

/** Offres d'abonnement ({ code, label, amount, months }), de la moins chère à la plus chère. */
export async function listPlans() {
  return unwrap(await supabase.from('plans').select('*').order('amount'))
}

/** Paiements d'abonnement de la pharmacie (administrateur), du plus récent au plus ancien. */
export async function listSubscriptionPayments() {
  return unwrap(await supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }).limit(50))
}

// La fonction Edge `billing` parle à PayDunya avec les clés du serveur.
async function billing(body) {
  const { data, error } = await supabase.functions.invoke('billing', { body })
  if (error) throw await functionError(error)
  return data
}

/** Ouvre un paiement pour l'offre `plan` : renvoie { url, token } (url = page de paiement PayDunya). */
export function startCheckout(plan) {
  return billing({ action: 'checkout', plan })
}

/**
 * État d'un paiement auprès de PayDunya : 'completed' | 'pending' | 'cancelled' |
 * 'failed' | 'review' | 'error' | 'unknown' (voir paymentOutcome).
 */
export async function verifyPayment(token) {
  const { status } = await billing({ action: 'verify', token })
  return status
}

/** Crée la pharmacie du compte connecté, qui en devient l'administrateur (essai gratuit). */
export async function registerPharmacy({ name, phone, address, full_name }) {
  return unwrap(
    await supabase.rpc('register_pharmacy', { p_name: name, p_phone: phone, p_address: address, p_full_name: full_name }),
  )
}

/** Modifie la fiche de la pharmacie (administrateur) : { id, name, phone, address }. */
export function savePharmacy({ id, name, phone, address }) {
  return saveRow('pharmacies', id, { name, phone, address })
}

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: listPlans, staleTime: 10 * 60_000 })
}

export function useSubscriptionPayments() {
  return useQuery({ queryKey: queryKeys.subscriptionPayments, queryFn: listSubscriptionPayments })
}

export function useStartCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startCheckout,
    // Même refusé, l'essai de paiement est tracé dans l'historique.
    onSettled: () => invalidate(queryClient, queryKeys.subscriptionPayments),
  })
}

/**
 * Vérifie le paiement `token` (retour de PayDunya). Une fois le paiement
 * validé, la pharmacie (dates d'abonnement) et l'historique sont rechargés.
 */
export function usePaymentCheck(token) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.paymentCheck(token),
    queryFn: async () => {
      const status = await verifyPayment(token)
      await invalidate(queryClient, ['profile'], queryKeys.subscriptionPayments)
      return status
    },
    enabled: Boolean(token),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Vérification manuelle d'un paiement de l'historique (bouton « Vérifier »). */
export function useVerifyPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: verifyPayment,
    onSettled: () => invalidate(queryClient, ['profile'], queryKeys.subscriptionPayments),
  })
}

export function useRegisterPharmacy() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: registerPharmacy, onSuccess: () => invalidate(queryClient, ['profile']) })
}

export function useSavePharmacy() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: savePharmacy, onSuccess: () => invalidate(queryClient, ['profile']) })
}
