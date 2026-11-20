import { cx } from './cx.js'
import styles from './controls.module.css'

/**
 * Zone de texte native stylée.
 * Props : invalid?, ref?, rows (défaut 3), + toutes les props natives de <textarea>.
 */
export function Textarea({ invalid = false, className, rows = 3, ref, ...props }) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(styles.control, styles.textarea, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}
