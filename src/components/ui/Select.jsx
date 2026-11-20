import { ChevronDown } from 'lucide-react'
import { cx } from './cx.js'
import styles from './controls.module.css'

/**
 * Liste déroulante native stylée.
 * Props : invalid?, ref?, children (<option>), + toutes les props natives de <select>.
 */
export function Select({ invalid = false, className, children, ref, ...props }) {
  return (
    <span className={styles.selectWrap}>
      <select
        ref={ref}
        className={cx(styles.control, styles.select, invalid && styles.invalid, className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className={styles.selectIcon} size={18} aria-hidden="true" />
    </span>
  )
}
