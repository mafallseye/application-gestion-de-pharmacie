import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow } from '../../lib/crud.js'
import { AppError, unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

const WITH_SELLER = '*, seller:profiles(id,full_name,email)'
const PAYMENT_CONFLICT =
  "Encaissement impossible : la vente a été modifiée entre-temps ou vous n'avez pas les droits nécessaires. Actualisez la page et réessayez."

/**
 * Ventes les plus récentes d'abord, avec `seller` ({ id, full_name, email } ou null).
 * `from` / `to` (AAAA-MM-JJ inclus) limitent la période côté serveur ;
 * `limit` borne le volume chargé (l'historique grossit sans fin).
 */
export async function listSales({ from, to, limit = 500 } = {}) {
  let query = supabase.from('sales').select(WITH_SELLER).order('sold_at', { ascending: false }).limit(limit)
  if (from) query = query.gte('sold_at', `${from}T00:00:00Z`)
  if (to) query = query.lte('sold_at', `${to}T23:59:59.999Z`)
  return unwrap(await query)
}

/** Une vente avec son vendeur et ses articles (`items`, dans l'ordre de saisie). */
export async function getSale(id) {
  const sale = unwrap(
    await supabase.from('sales').select(`${WITH_SELLER}, items:sale_items(*)`).eq('id', id).single(),
    { PGRST116: 'Cette vente est introuvable.' },
  )
  sale.items.sort((a, b) => a.id - b.id)
  return sale
}

/**
 * Enregistre une vente (contrôle du stock et calcul du total faits en base).
 * items : [{ medicine_id, quantity }] — voir toSaleItems(cart). Renvoie l'id de la vente.
 */
export async function createSale({ customerId = null, paidAmount, items }) {
  return unwrap(
    await supabase.rpc('create_sale', {
      p_customer_id: customerId,
      p_paid_amount: paidAmount,
      p_items: items,
    }),
  )
}

/**
 * Ajoute `amount` au montant déjà payé de la vente `sale` (telle qu'affichée).
 * Le filtre sur l'ancien montant évite d'écraser un encaissement saisi au même
 * moment sur un autre poste : dans ce cas aucune ligne n'est modifiée.
 */
export async function recordPayment({ sale, amount }) {
  const rows = unwrap(
    await supabase
      .from('sales')
      .update({ paid_amount: Number(sale.paid_amount) + amount })
      .eq('id', sale.id)
      .eq('paid_amount', sale.paid_amount)
      .select(),
    { 23514: 'Le montant dépasse le reste à payer.' },
  )
  if (rows.length === 0) throw new AppError(PAYMENT_CONFLICT)
  return rows[0]
}

/** Supprime une vente (administrateur) : le stock est remis en base. */
export function deleteSale(id) {
  return deleteRow('sales', id)
}

export function useSales(filters = {}) {
  return useQuery({ queryKey: queryKeys.salesList(filters), queryFn: () => listSales(filters) })
}

export function useSale(id) {
  return useQuery({ queryKey: queryKeys.sale(id), queryFn: () => getSale(id), enabled: id != null })
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
