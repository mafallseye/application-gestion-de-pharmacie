import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow, pick, saveRow } from '../../lib/crud.js'
import { unwrap } from '../../lib/errors.js'
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
  return unwrap(await supabase.from('medicines').select(WITH_RELATIONS).order('brand_name'))
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

export function useMedicines() {
  return useQuery({ queryKey: queryKeys.medicines, queryFn: listMedicines })
}

export function useSaveMedicine() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveMedicine, onSuccess: () => refresh(queryClient) })
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteMedicine, onSuccess: () => refresh(queryClient) })
}
