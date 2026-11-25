import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow } from '../../lib/crud.js'
import { AppError, unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

const WITH_SELLER = '*, seller:profiles(id,full_name,email)'
const WITH_DETAILS = `${WITH_SELLER}, items:sale_items(*), payments(id,amount,method,created_at,author:profiles(id,full_name,email)), mobile_payments:sale_mobile_payments(id,amount,status,order_id,checkout_url,created_at)`
/**
 * Ventes les plus récentes d'abord, avec `seller` ({ id, full_name, email } ou null).
 * `from` / `to` (AAAA-MM-JJ inclus) limitent la période côté serveur ;
 * `unpaidOnly` ne garde que les ventes avec un reste à payer (filtre serveur) ;
 * `limit` borne le volume chargé (l'historique grossit sans fin).
 */
export async function listSales({ from, to, unpaidOnly = false, limit = 500 } = {}) {
  let query = supabase.from('sales').select(WITH_SELLER).order('sold_at', { ascending: false }).limit(limit)
  if (from) query = query.gte('sold_at', `${from}T00:00:00Z`)
  if (to) query = query.lte('sold_at', `${to}T23:59:59.999Z`)
  if (unpaidOnly) query = query.gt('balance', 0)
  return unwrap(await query)
}

/**
 * Une vente avec son vendeur, ses articles (`items`, dans l'ordre de saisie),
 * l'historique de ses paiements (`payments`, du plus ancien au plus récent) et
 * ses demandes de paiement mobile (`mobile_payments`).
 */
export async function getSale(id) {
  const sale = unwrap(
    await supabase.from('sales').select(WITH_DETAILS).eq('id', id).maybeSingle(),
  )
  if (!sale) throw new AppError('Cette vente est introuvable.')
  sale.items.sort((a, b) => a.id - b.id)
  sale.payments.sort((a, b) => a.id - b.id)
  return sale
}

/**
 * Enregistre une vente (contrôle du stock et calcul du total faits en base).
 * items : [{ medicine_id, quantity }] — voir toSaleItems(cart).
 * expectedTotal : total affiché à la caisse ; la base refuse la vente si les
 * prix ont changé entre-temps. Renvoie { id, number } : l'identifiant technique
 * de la vente et son numéro dans la pharmacie (celui qu'on affiche).
 * mobile : vente payée par mobile money — elle est créée impayée (paidAmount 0),
 * « en attente de paiement mobile », puis soldée ou annulée par le serveur.
 */
export async function createSale({ customerId = null, paidAmount, items, expectedTotal, mobile = false }) {
  const id = unwrap(
    await supabase.rpc('create_sale', {
      p_customer_id: customerId,
      p_paid_amount: paidAmount,
      p_items: items,
      p_expected_total: expectedTotal,
      p_mobile: mobile,
    }),
  )
  const sale = unwrap(await supabase.from('sales').select('number').eq('id', id).maybeSingle())
  return { id, number: sale?.number ?? null }
}

/** Vrai si la vente existe encore (une vente « mobile » refusée par le prestataire est supprimée par le serveur). */
export async function saleExists(id) {
  return unwrap(await supabase.from('sales').select('id').eq('id', id).maybeSingle()) !== null
}

/**
 * Encaisse `amount` sur la vente (RPC record_payment : ajout atomique, refuse
 * de dépasser le reste à payer). Renvoie le nouveau montant payé.
 */
export async function recordPayment({ saleId, amount }) {
  return unwrap(await supabase.rpc('record_payment', { p_sale_id: saleId, p_amount: amount }))
}

/** Supprime une vente (administrateur) : le stock est remis en base. */
export function deleteSale(id) {
  return deleteRow('sales', id)
}

export function useSales(filters = {}) {
  return useQuery({ queryKey: queryKeys.salesList(filters), queryFn: () => listSales(filters) })
}

/** `enabled: false` suspend la requête (ex. pendant la suppression de la vente affichée). */
export function useSale(id, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.sale(id), queryFn: () => getSale(id), enabled: enabled && id != null })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSale,
    // Même en cas d'échec (ex. stock insuffisant), le stock affiché est périmé.
    onSettled: () => invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard),
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recordPayment,
    onSettled: () => invalidate(queryClient, queryKeys.sales, queryKeys.dashboard),
  })
}

export function useDeleteSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSale,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.sale(id) })
      return invalidate(queryClient, queryKeys.sales, queryKeys.medicines, queryKeys.dashboard)
    },
  })
}
