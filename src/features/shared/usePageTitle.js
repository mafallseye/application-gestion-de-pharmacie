import { useEffect } from 'react'

/** Titre de l'onglet du navigateur pour la page affichée. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · PharmaCaisse` : 'PharmaCaisse'
  }, [title])
}
