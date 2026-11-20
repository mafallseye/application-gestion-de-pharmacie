import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

/**
 * Hook des notifications éphémères. À utiliser sous <ToastProvider>.
 * Retourne { success(msg), error(msg), info(msg), dismiss(id) } ; chaque méthode
 * d'affichage retourne l'identifiant du toast.
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur de <ToastProvider>.')
  }
  return context
}
