import { Logo } from './Logo.jsx'
import styles from './AuthLayout.module.css'

// Plaquette de comprimés : 1 = alvéole pleine, 0 = alvéole déjà percée.
const BLISTER = [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1]

/**
 * Mise en page des écrans hors session : connexion, compte en attente d'activation…
 * Props : title, subtitle?, children (formulaire ou message), footer? (nœud sous la
 * carte, ex. lien d'aide), brand? (défaut « PharmaCaisse »).
 */
export function AuthLayout({ title, subtitle, children, footer, brand = 'PharmaCaisse' }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.aside}>
        <div className={styles.brand}>
          <Logo size={40} />
          <span className={styles.brandName}>{brand}</span>
        </div>
        <p className={styles.statement}>Le stock, les ventes et la caisse de l’officine, au même comptoir.</p>
        <div className={styles.blister} aria-hidden="true">
          {BLISTER.map((full, index) => (
            <span key={index} className={full ? styles.pill : styles.pillEmpty} />
          ))}
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.panel}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          <div className={styles.body}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
