import { cx } from './cx.js'
import styles from './StatCard.module.css'

/**
 * Indicateur chiffré du tableau de bord.
 * Props : label, value (texte déjà formaté, ex. « 184 500 FCFA »), hint? (précision
 * sous la valeur), icon? (composant lucide), tone? 'neutral'|'success'|'warning'|'danger'|'info'
 * (défaut 'neutral' ; les tons warning/danger ajoutent un filet de couleur à gauche), className?.
 */
export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', className }) {
  return (
    <article className={cx(styles.card, styles[tone], className)}>
      <div className={styles.top}>
        <p className={styles.label}>{label}</p>
        {Icon ? (
          <span className={styles.icon} aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className={styles.value} data-numeric>
        {value}
      </p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </article>
  )
}
