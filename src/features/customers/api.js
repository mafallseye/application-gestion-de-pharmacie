import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow, fetchAllRows, pick, saveRow } from '../../lib/crud.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { filterBySearch } from '../../lib/search.js'
import { supabase } from '../../lib/supabase.js'

const COLUMNS = ['name', 'address', 'phone', 'fax', 'info']

export async function listCustomers() {
  return fetchAllRows(() => supabase.from('customers').select('*').order('name').order('id'))
}

/** Crée (sans id) ou modifie (avec id). */
export function saveCustomer({ id, ...fields }) {
  return saveRow('customers', id, pick(fields, COLUMNS))
}

export function deleteCustomer(id) {
  return deleteRow('customers', id)
}

export function searchCustomers(items, query) {
  return filterBySearch(items, query, ['name', 'address', 'phone', 'info'])
}

// Supprimer un client détache ses ventes ; le tableau de bord compte les clients.
function refresh(queryClient) {
  return invalidate(queryClient, queryKeys.customers, queryKeys.sales, queryKeys.dashboard)
}

export function useCustomers() {
  return useQuery({ queryKey: queryKeys.customers, queryFn: listCustomers })
}

export function useSaveCustomer() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveCustomer, onSuccess: () => refresh(queryClient) })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteCustomer, onSuccess: () => refresh(queryClient) })
}
