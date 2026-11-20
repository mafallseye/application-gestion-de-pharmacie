import { QueryClient } from '@tanstack/react-query'

// Inutile de réessayer une requête refusée (droits, validation, session) :
// seules les pannes réseau ou serveur méritent une nouvelle tentative.
function shouldRetry(failureCount, error) {
  return error?.retryable === true && failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: false },
    },
  })
}
