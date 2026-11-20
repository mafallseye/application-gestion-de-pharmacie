// Filtrage des ventes côté client (pur, sans accès réseau).
import { matchesSearch } from '../../lib/search.js'
import { balanceDue } from './cart.js'

export function saleBalance(sale) {
  return balanceDue(sale.grand_total, sale.paid_amount)
}

export function customerLabel(sale) {
  return sale.customer_name || 'Client de passage'
}

/** 'paid' | 'partial' | 'unpaid' */
export function paymentStatus(sale) {
  if (saleBalance(sale) === 0) return 'paid'
  return Number(sale.paid_amount) > 0 ? 'partial' : 'unpaid'
}

/**
 * filters : { search, unpaidOnly, from, to } — tous facultatifs.
 * `search` porte sur le client, le vendeur et le numéro de vente ;
 * `from` / `to` sont des dates AAAA-MM-JJ incluses (jour de Dakar = UTC).
 */
export function filterSales(sales, filters = {}) {
  const { search = '', unpaidOnly = false, from = '', to = '' } = filters
  return (sales ?? []).filter((sale) => {
    const day = String(sale.sold_at).slice(0, 10)
    const row = { id: sale.id, customer_name: sale.customer_name, seller_name: sale.seller?.full_name }
    return (
      matchesSearch(row, search, ['id', 'customer_name', 'seller_name']) &&
      (!unpaidOnly || saleBalance(sale) > 0) &&
      (!from || day >= from) &&
      (!to || day <= to)
    )
  })
}
