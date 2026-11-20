import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, Card, EmptyState } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'

export default function NotFoundPage() {
  usePageTitle('Page introuvable')
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page introuvable"
        message="Cette adresse ne correspond à aucune page de l’application."
        action={
          <Button as={Link} to="/">
            Retour au tableau de bord
          </Button>
        }
      />
    </Card>
  )
}
