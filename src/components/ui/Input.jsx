import { cx } from './cx.js'
import styles from './controls.module.css'

/**
 * Champ de saisie natif stylé.
 * Props : invalid? (bordure d'erreur), ref?, suffix? (texte affiché à droite,
 * ex. « FCFA »), + toutes les props natives de <input>.
 */
export function Input({ invalid = false, suffix, className, type = 'text', ref, ...props }) {
  const input = (
    <input
      ref={ref}
      type={type}
      className={cx(styles.control, invalid && styles.invalid, suffix && styles.withSuffix, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
  if (!suffix) return input
  return (
    <span className={styles.affixWrap}>
      {input}
      <span className={styles.suffix} aria-hidden="true">
        {suffix}
      </span>
    </span>
  )
}
