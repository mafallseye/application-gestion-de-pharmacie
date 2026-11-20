import { cx } from './cx.js'
import styles from './Spinner.module.css'

/**
 * Indicateur de chargement.
 * Props : size? (px, défaut 20), label? (texte lu par les lecteurs d'écran,
 * défaut « Chargement… » ; passer '' pour un spinner purement décoratif), className?.
 */
export function Spinner({ size = 20, label = 'Chargement…', className }) {
  return (
    <span
      className={cx(styles.spinner, className)}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className={styles.track} cx="12" cy="12" r="9" strokeWidth="3" />
        <path className={styles.arc} d="M12 3a9 9 0 0 1 9 9" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

/**
 * Chargement d'une page entière ou d'une zone.
 * Props : label? (texte visible, défaut « Chargement… »),
 * fullScreen? (défaut true : occupe toute la hauteur de l'écran ; false : centré dans son parent).
 */
export function PageLoader({ label = 'Chargement…', fullScreen = true }) {
  return (
    <div className={cx(styles.page, fullScreen && styles.fullScreen)} role="status">
      <Spinner size={28} label="" />
      <span className={styles.pageLabel}>{label}</span>
    </div>
  )
}
