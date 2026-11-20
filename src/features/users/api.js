import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllRows, pick, saveRow } from '../../lib/crud.js'
import { functionError } from '../../lib/errors.js'
import { invalidate, queryKeys } from '../../lib/queryKeys.js'
import { filterBySearch } from '../../lib/search.js'
import { supabase } from '../../lib/supabase.js'

// Seules colonnes de `profiles` modifiables (par un administrateur).
const EDITABLE = ['full_name', 'role', 'active']

export async function listProfiles() {
  return fetchAllRows(() => supabase.from('profiles').select('*').order('full_name').order('id'))
}

/** { id, full_name?, role?, active? } → profil mis à jour. */
export function updateProfile({ id, ...fields }) {
  return saveRow('profiles', id, pick(fields, EDITABLE))
}

// Création, mot de passe et suppression passent par la fonction Edge
// `admin-users` (elle seule détient la clé de service).
async function adminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw await functionError(error)
  return data
}

/** { email, password, full_name, role } → { id } ; le compte est actif immédiatement. */
export function createUser({ email, password, full_name, role }) {
  return adminUsers({ action: 'create', email, password, full_name, role })
}

export function setUserPassword({ userId, password }) {
  return adminUsers({ action: 'set_password', user_id: userId, password })
}

export function deleteUser(userId) {
  return adminUsers({ action: 'delete', user_id: userId })
}

export function searchProfiles(profiles, query) {
  return filterBySearch(profiles, query, ['full_name', 'email'])
}

export function useProfiles() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: listProfiles })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    // Le profil modifié peut être celui de l'utilisateur connecté (son nom).
    onSuccess: (profile) => invalidate(queryClient, queryKeys.profiles, queryKeys.profile(profile.id), queryKeys.sales),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: createUser, onSuccess: () => invalidate(queryClient, queryKeys.profiles) })
}

export function useSetUserPassword() {
  return useMutation({ mutationFn: setUserPassword })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    // Les ventes de l'utilisateur supprimé perdent leur vendeur.
    onSuccess: () => invalidate(queryClient, queryKeys.profiles, queryKeys.sales),
  })
}
