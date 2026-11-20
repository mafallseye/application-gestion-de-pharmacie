import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pharmacie-theme'

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Thème clair/sombre. Suit le système tant que l'utilisateur n'a rien choisi ;
 * le choix est mémorisé dans localStorage (clé « pharmacie-theme ») et appliqué
 * via l'attribut data-theme de <html>.
 * Retourne { theme: 'light'|'dark', toggleTheme() }.
 */
export function useTheme() {
  const [choice, setChoice] = useState(readStoredTheme)
  const [system, setSystem] = useState(systemTheme)

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = (event) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (choice) document.documentElement.setAttribute('data-theme', choice)
    else document.documentElement.removeAttribute('data-theme')
  }, [choice])

  const theme = choice ?? system

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour la session.
    }
  }, [theme])

  return { theme, toggleTheme }
}
