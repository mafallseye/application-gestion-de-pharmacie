import { cx } from './cx.js'
import styles from './Layout.module.css'

/**
 * Grille de formulaire responsive (une colonne sur téléphone).
 * Props : columns? 1|2|3 (défaut 2), children (des <Field>), className?.
 * Pour qu'un champ occupe toute la ligne, l'envelopper dans <FullRow>.
 */
export function FormGrid({ columns = 2, className, children }) {
  return <div className={cx(styles.formGrid, styles[`cols${columns}`], className)}>{children}</div>
}

/**
 * Barre d'outils au-dessus d'une table : recherche et filtres à gauche, actions à droite.
 * Props : children (le premier enfant s'étire, ex. SearchInput), className?.
 */
export function Toolbar({ className, children }) {
  return <div className={cx(styles.toolbar, className)}>{children}</div>
}

/**
 * Grille fluide d'éléments de même largeur (StatCard, cartes…).
 * Props : min? (largeur minimale d'une colonne, défaut '14rem'), gap? (défaut var(--space-4)), children, className?.
 */
export function Grid({ min = '14rem', gap, className, children }) {
  return (
    <div className={cx(styles.grid, className)} style={{ '--grid-min': min, ...(gap ? { '--grid-gap': gap } : null) }}>
      {children}
    </div>
  )
}

/**
 * Pile verticale à espacement régulier.
 * Props : gap? (défaut var(--space-6)), children, className?.
 */
export function Stack({ gap, className, children }) {
  return (
    <div className={cx(styles.stack, className)} style={gap ? { '--stack-gap': gap } : undefined}>
      {children}
    </div>
  )
}

/**
 * Enfant de FormGrid occupant toute la largeur de la grille.
 * Props : children, className?.
 */
export function FullRow({ className, children }) {
  return <div className={cx(styles.fullRow, className)}>{children}</div>
}
