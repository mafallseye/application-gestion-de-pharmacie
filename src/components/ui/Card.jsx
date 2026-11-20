import { cx } from './cx.js'
import styles from './Card.module.css'

/**
 * Surface de regroupement.
 * Props : title?, actions? (nœud aligné à droite du titre), padded (défaut true ;
 * false pour y loger une DataTable bord à bord), subtitle?, className?, children.
 */
export function Card({ title, subtitle, actions, padded = true, className, children }) {
  return (
    <section className={cx(styles.card, className)}>
      {title || actions ? (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx(styles.body, padded && styles.padded, (title || actions) && styles.afterHeader)}>{children}</div>
    </section>
  )
}
