import styles from './PageHeader.module.css'

/**
 * En-tête de page : titre, sous-titre et actions principales.
 * Props : title, subtitle?, actions? (nœud : boutons alignés à droite).
 */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  )
}
