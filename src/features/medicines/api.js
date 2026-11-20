import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow, fetchAllRows, pick, saveRow } from '../../lib/crud.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { supabase } from '../../lib/supabase.js'

const COLUMNS = [
  'brand_name',
  'generic_name',
  'category_id',
  'supplier_id',
  'price',
  'quantity',
  'low_stock_threshold',
  'expiry_date',
]
const WITH_RELATIONS = '*, category:categories(id,name), supplier:suppliers(id,name)'

/** Médicaments avec `category` et `supplier` ({ id, name } ou null). */
export async function listMedicines() {
  return fetchAllRows(() => supabase.from('medicines').select(WITH_RELATIONS).order('brand_name').order('id'))
}

/** Crée (sans id) ou modifie (avec id). */
export function saveMedicine({ id, ...fields }) {
  return saveRow('medicines', id, pick(fields, COLUMNS))
}

export function deleteMedicine(id) {
  return deleteRow('medicines', id)
}

function refresh(queryClient) {
  return invalidate(queryClient, queryKeys.medicines, queryKeys.dashboard)
}

/** `refetchInterval` (ms) : rechargement périodique, utilisé par la caisse pour suivre prix et stock. */
export function useMedicines({ refetchInterval = false } = {}) {
  return useQuery({ queryKey: queryKeys.medicines, queryFn: listMedicines, refetchInterval })
}

export function useSaveMedicine() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveMedicine, onSuccess: () => refresh(queryClient) })
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteMedicine, onSuccess: () => refresh(queryClient) })
}
