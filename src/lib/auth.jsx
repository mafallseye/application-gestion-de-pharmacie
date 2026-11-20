import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError, unwrap } from './errors.js'
import { queryKeys } from './queryKeys.js'
import { supabase } from './supabase.js'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAppError(error)
}

async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw toAppError(error)
}

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
  })
  const profile = user ? (profileQuery.data ?? null) : null

  const value = useMemo(() => {
    const active = profile?.active === true
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
      signIn,
      signOut,
    }
  }, [session, user, profile, profileQuery.isPending, profileQuery.isSuccess, profileQuery.error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Le hook vit avec son fournisseur : un seul fichier à importer pour l'authentification.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être utilisé sous <AuthProvider>.')
  return value
}
