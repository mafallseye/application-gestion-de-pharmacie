import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cx } from './cx.js'
import styles from './Alert.module.css'

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert }

/**
 * Message en ligne dans la page ou un formulaire.
 * Props : tone 'info'|'success'|'warning'|'danger' (défaut 'info'), title?, children,
 * action? (nœud à droite, ex. un Button size="sm"), className?.
 * Les tons warning/danger sont annoncés immédiatement (role="alert").
 */
export function Alert({ tone = 'info', title, action, className, children }) {
  const Icon = ICONS[tone] ?? Info
  return (
    <div className={cx(styles.alert, styles[tone], className)} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>
      <Icon className={styles.icon} size={18} aria-hidden="true" />
      <div className={styles.content}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
