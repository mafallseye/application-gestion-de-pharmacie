import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'

/** Échec de chargement d'une requête React Query, avec bouton « Réessayer ». */
export function LoadError({ query }) {
  return (
    <Alert
      tone="danger"
      title="Chargement impossible"
      action={
        <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => query.refetch()}>
          Réessayer
        </Button>
      }
    >
      {errorMessage(query.error)}
    </Alert>
  )
}
