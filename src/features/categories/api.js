import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRow, pick, saveRow } from '../../lib/crud.js'
import { unwrap } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { filterBySearch } from '../../lib/search.js'
import { supabase } from '../../lib/supabase.js'

const COLUMNS = ['name', 'short_name']

export async function listCategories() {
  return unwrap(await supabase.from('categories').select('*').order('name'))
}

/** Crée (sans id) ou modifie (avec id). */
export function saveCategory({ id, ...fields }) {
  return saveRow('categories', id, pick(fields, COLUMNS), { 23505: 'Une catégorie porte déjà ce nom.' })
}

export function deleteCategory(id) {
  return deleteRow('categories', id)
}

export function searchCategories(items, query) {
  return filterBySearch(items, query, ['name', 'short_name'])
}

// Les médicaments affichent le nom de leur catégorie (et la perdent si elle est supprimée).
function refresh(queryClient) {
  return invalidate(queryClient, queryKeys.categories, queryKeys.medicines)
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: listCategories })
}

export function useSaveCategory() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveCategory, onSuccess: () => refresh(queryClient) })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteCategory, onSuccess: () => refresh(queryClient) })
}
