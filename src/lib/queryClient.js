import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  // Un refus de droits (42501) signale souvent un compte désactivé ou un rôle
  // changé en cours de session : on recharge le profil, et les gardes de
  // l'application basculent d'elles-mêmes (écran « compte en attente »…).
  const recheckProfile = (error) => {
    if (error?.code === '42501') client.invalidateQueries({ queryKey: ['profile'] })
  }
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: recheckProfile }),
    mutationCache: new MutationCache({ onError: recheckProfile }),
    defaultOptions: {
      // Pas de nouvelle tentative ici : supabase-js réessaie déjà de lui-même
      // les lectures après une panne réseau (jusqu'à 3 fois, sur quelques secondes).
      queries: { staleTime: 30_000, retry: false },
      mutations: { retry: false },
    },
  })
  return client
}
