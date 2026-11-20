import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppError, toAppError, unwrap } from './errors.js'
import { queryKeys } from './queryKeys.js'
import { subscriptionState } from './subscription.js'
import { supabase } from './supabase.js'

const AuthContext = createContext(null)

// Le profil est lu avec sa pharmacie (`pharmacy`, null tant que le compte
// n'est rattaché à aucune pharmacie ou n'est pas actif).
async function fetchProfile(userId) {
  return unwrap(await supabase.from('profiles').select('*, pharmacy:pharmacies(*)').eq('id', userId).maybeSingle())
}

const EMAIL_TAKEN = 'Cette adresse e-mail est déjà utilisée. Connectez-vous, ou choisissez une autre adresse.'

/**
 * Crée un compte. Renvoie { needsConfirmation } : vrai si le projet exige de
 * confirmer l'adresse e-mail avant la première connexion.
 */
async function signUp({ email, password, full_name }) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } })
  if (error) throw toAppError(error)
  // Adresse déjà inscrite : Supabase répond « succès » avec un utilisateur sans identité.
  if (data.user && data.user.identities?.length === 0) throw new AppError(EMAIL_TAKEN)
  return { needsConfirmation: !data.session }
}

async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAppError(error)
}

// Déconnexion de cet appareil seulement : la session locale est supprimée avant
// l'appel réseau, donc cela fonctionne hors ligne et sans toucher aux autres
// postes. Une erreur réseau éventuelle (révocation côté serveur) est sans
// conséquence pour l'utilisateur : elle est ignorée.
async function signOut() {
  await supabase.auth.signOut({ scope: 'local' })
}

/** Change le mot de passe de l'utilisateur connecté. */
async function changePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toAppError(error)
}

// Un compte désactivé ou un rôle modifié par un administrateur est pris en
// compte sans rechargement, au plus tard après ce délai.
const PROFILE_REFRESH_MS = 60_000

/** À placer sous QueryClientProvider. */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  // undefined = session pas encore lue ; null = déconnecté.
  const [session, setSession] = useState(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return undefined
    // Le callback reste synchrone et n'appelle jamais Supabase : un appel
    // asynchrone ici peut bloquer le client (verrou interne de supabase-js).
    // Le profil est chargé à part, par la requête ci-dessous.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      // Aucune donnée d'un utilisateur ne doit rester en mémoire après lui.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const user = session?.user ?? null
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(user?.id),
    queryFn: () => fetchProfile(user.id),
    enabled: user !== null,
    refetchInterval: PROFILE_REFRESH_MS,
  })
  const profile = user ? (profileQuery.data ?? null) : null

  const value = useMemo(() => {
    // Membre du personnel : compte activé ET rattaché à une pharmacie.
    const active = profile?.active === true && profile.pharmacy_id != null
    const pharmacy = profile?.pharmacy ?? null
    // L'abonnement est évalué à l'heure du dernier chargement du profil (rechargé
    // toutes les minutes) : le calcul reste ainsi stable entre deux rendus.
    const subscription = subscriptionState(pharmacy, new Date(profileQuery.dataUpdatedAt))
    const canWrite = active && subscription.canWrite
    return {
      session: session ?? null,
      user,
      profile,
      loading: session === undefined || (user !== null && profileQuery.isPending),
      // Échec du chargement du profil (ex. panne réseau) : AppError ou null.
      profileError: user ? profileQuery.error : null,
      // Connecté mais pas (ou plus) activé par un administrateur.
      isInactive: user !== null && profileQuery.isSuccess && !active,
      isStaff: active,
      isManager: active && (profile.role === 'admin' || profile.role === 'pharmacien'),
      isAdmin: active && profile.role === 'admin',
      // Compte connecté qui n'a pas encore créé (ou rejoint) de pharmacie.
      needsPharmacy: user !== null && profileQuery.isSuccess && profile !== null && profile.pharmacy_id == null,
      pharmacy,
      // { status: 'trial'|'active'|'expired', endsAt, daysLeft, canWrite, endingSoon }
      subscription,
      // Sans essai ni abonnement en cours, la pharmacie est en lecture seule :
      // ces droits reprennent ceux du rôle, limités par l'abonnement.
      canWrite,
      canSell: canWrite,
      canManage: canWrite && (profile.role === 'admin' || profile.role === 'pharmacien'),
      refreshProfile: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id) }),
      signUp,
      signIn,
      signOut,
      changePassword,
    }
  }, [session, user, profile, queryClient, profileQuery.isPending, profileQuery.isSuccess, profileQuery.error, profileQuery.dataUpdatedAt])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Le hook vit avec son fournisseur : un seul fichier à importer pour l'authentification.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être utilisé sous <AuthProvider>.')
  return value
}
