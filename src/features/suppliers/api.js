import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow, pick, saveRow } from '../../lib/crud.js'
import { unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { filterBySearch } from '../../lib/search.js'
import { supabase } from '../../lib/supabase.js'

const COLUMNS = ['name', 'address', 'phone', 'fax', 'info']

export async function listSuppliers() {
  return unwrap(await supabase.from('suppliers').select('*').order('name'))
}

/** Crée (sans id) ou modifie (avec id). */
export function saveSupplier({ id, ...fields }) {
  return saveRow('suppliers', id, pick(fields, COLUMNS))
}

export function deleteSupplier(id) {
  return deleteRow('suppliers', id)
}

export function searchSuppliers(items, query) {
  return filterBySearch(items, query, ['name', 'address', 'phone', 'info'])
}

// Les médicaments affichent le nom de leur fournisseur ; le tableau de bord les compte.
function refresh(queryClient) {
  return invalidate(queryClient, queryKeys.suppliers, queryKeys.medicines, queryKeys.dashboard)
}

export function useSuppliers() {
  return useQuery({ queryKey: queryKeys.suppliers, queryFn: listSuppliers })
}

export function useSaveSupplier() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveSupplier, onSuccess: () => refresh(queryClient) })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteSupplier, onSuccess: () => refresh(queryClient) })
}
