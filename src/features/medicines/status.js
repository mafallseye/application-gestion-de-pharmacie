// Libellés et couleurs des états d'un médicament (badges, filtres).
import { medicineStatus } from '../../lib/format.js'

/** Filtres d'état proposés dans la liste (clés de MEDICINE_STATUS_FILTERS). */
export const STATUS_OPTIONS = [
  { value: 'expired', label: 'Périmés' },
  { value: 'expiring', label: 'Expirent bientôt' },
  { value: 'low_stock', label: 'Stock bas' },
  { value: 'out_of_stock', label: 'En rupture' },
]

/** Badges à afficher pour un médicament : [{ tone, label }], le plus grave d'abord. */
export function medicineBadges(medicine, today) {
  const status = medicineStatus(medicine, today)
  const badges = []
  if (status.expired) badges.push({ tone: 'danger', label: 'Périmé' })
  else if (status.expiringSoon) badges.push({ tone: 'warning', label: 'Expire bientôt' })
  if (status.outOfStock) badges.push({ tone: 'neutral', label: 'Rupture' })
  else if (status.lowStock) badges.push({ tone: 'warning', label: 'Stock bas' })
  if (badges.length === 0) badges.push({ tone: 'success', label: 'En stock' })
  return badges
}
