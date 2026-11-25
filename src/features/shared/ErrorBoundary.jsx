import { Component } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, EmptyState } from '../../components/ui'
import { SupportLine } from './SupportLine.jsx'
import styles from './ErrorBoundary.module.css'

/**
 * Rattrape une erreur de rendu ou l'échec de chargement d'une page (morceau
 * `lazy` introuvable après un nouveau déploiement) et propose de recharger.
 * Props : children, fullScreen? (centré dans l'écran, pour la racine),
 * resetKey? (quand il change, ex. l'adresse de la page, l'erreur est oubliée).
 */
export class ErrorBoundary extends Component {
  state = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={this.props.fullScreen ? styles.fullScreen : undefined} role="alert">
        <EmptyState
          icon={TriangleAlert}
          title="Cette page n’a pas pu s’afficher"
          message="Une nouvelle version de l’application a peut-être été installée, ou la connexion a été interrompue. Rechargez la page pour continuer."
          action={
            <>
              <Button icon={RefreshCw} onClick={() => window.location.reload()}>
                Recharger la page
              </Button>
              <SupportLine className={styles.support} />
            </>
          }
        />
      </div>
    )
  }
}
