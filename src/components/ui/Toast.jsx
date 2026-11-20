import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cx } from './cx.js'
import { ToastContext } from './ToastContext.js'
import styles from './Toast.module.css'

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }
const DURATIONS = { success: 4500, info: 4500, error: 7000 }
const MAX_VISIBLE = 4

/**
 * Fournisseur des notifications éphémères (toasts). À placer une seule fois,
 * près de la racine de l'application. Les messages s'affichent dans une région
 * aria-live et disparaissent seuls (4,5 s ; 7 s pour les erreurs).
 * Props : children.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const nextId = useRef(1)

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone, message) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, tone, message }].slice(-MAX_VISIBLE))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATIONS[tone]),
      )
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone]
          return (
            <div key={toast.id} className={cx(styles.toast, styles[toast.tone])} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon className={styles.icon} size={18} aria-hidden="true" />
              <p className={styles.message}>{toast.message}</p>
              <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Fermer la notification">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
