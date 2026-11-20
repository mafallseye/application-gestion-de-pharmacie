// Filtrage des médicaments côté client (pur, sans accès réseau).
import { isExpired, isExpiringSoon, isLowStock, isOutOfStock, isSellable, todayISO } from '../../lib/format.js'
import { matchesSearch } from '../../lib/search.js'

/** Valeurs possibles du filtre `status`. */
export const MEDICINE_STATUS_FILTERS = {
  expired: isExpired,
  expiring: isExpiringSoon,
  low_stock: isLowStock,
  out_of_stock: isOutOfStock,
  sellable: isSellable,
}

function matchesText(medicine, search) {
  const row = { ...medicine, category_name: medicine.category?.name, supplier_name: medicine.supplier?.name }
  return matchesSearch(row, search, ['brand_name', 'generic_name', 'category_name', 'supplier_name'])
}

/**
 * filters : { search, categoryId, supplierId, status } — tous facultatifs.
 * `status` est une clé de MEDICINE_STATUS_FILTERS.
 */
export function filterMedicines(medicines, filters = {}, today = todayISO()) {
  const { search = '', categoryId = null, supplierId = null, status = null } = filters
  const statusTest = MEDICINE_STATUS_FILTERS[status]
  return (medicines ?? []).filter(
    (medicine) =>
      matchesText(medicine, search) &&
      (!categoryId || medicine.category_id === Number(categoryId)) &&
      (!supplierId || medicine.supplier_id === Number(supplierId)) &&
      (!statusTest || statusTest(medicine, today)),
  )
}
