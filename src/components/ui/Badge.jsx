import { cx } from './cx.js'
import styles from './Badge.module.css'

/**
 * Étiquette d'état courte (« En stock », « Impayée »…).
 * Props : tone 'neutral'|'success'|'warning'|'danger'|'info' (défaut 'neutral'),
 * icon? (composant lucide), children, className?.
 */
export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {Icon ? <Icon size={13} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
