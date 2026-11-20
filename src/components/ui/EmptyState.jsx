import { cx } from './cx.js'
import styles from './EmptyState.module.css'

/**
 * État vide : explique ce qui manque et propose une action.
 * Props : icon? (composant lucide), title, message?, action? (nœud, ex. un Button),
 * compact? (marges réduites, pour l'intérieur d'une table ou d'un panier).
 */
export function EmptyState({ icon: Icon, title, message, action, compact = false }) {
  return (
    <div className={cx(styles.empty, compact && styles.compact)}>
      {Icon ? (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={22} strokeWidth={1.75} />
        </span>
      ) : null}
      <p className={styles.title}>{title}</p>
      {message ? <p className={styles.message}>{message}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
