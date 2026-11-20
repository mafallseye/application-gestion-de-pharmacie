import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../lib/errors.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

/**
 * Chiffres du tableau de bord : medicines_count, stock_value, low_stock_count,
 * expired_count, expiring_count, customers_count, suppliers_count, sales_today,
 * sales_month, unpaid_total, sales_by_day ([{ day, total }] sur 7 jours).
 */
export async function getDashboardStats() {
  return unwrap(await supabase.rpc('dashboard_stats'))
}

export function useDashboardStats() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboardStats })
}
