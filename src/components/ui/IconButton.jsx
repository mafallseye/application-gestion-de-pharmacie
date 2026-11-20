import { cx } from './cx.js'
import styles from './IconButton.module.css'

/**
 * Bouton réduit à une icône.
 * Props : icon (composant lucide), label (aria-label + infobulle),
 * variant? 'ghost'|'danger' (défaut 'ghost'), size? 'sm'|'md' (40px ou 44px, défaut 'sm'),
 * + props natives de <button>.
 */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'sm', type = 'button', className, ...props }) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
