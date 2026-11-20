import { cx } from './cx.js'
import styles from './BarChart.module.css'

const VALUE_ROW = 22
const LABEL_ROW = 28

/**
 * Petit graphique en barres (CSS pur, sans dépendance), pensé pour « ventes des
 * 7 derniers jours ». Chaque barre affiche sa valeur en clair : le graphique est
 * une liste lisible par les lecteurs d'écran.
 * Props : data [{ label, value }], formatValue?(n) → texte (défaut : nombre au format fr-FR),
 * height? (px, défaut 220), highlight? (index de la barre mise en avant, ex. aujourd'hui ;
 * les autres sont atténuées), label? (titre accessible du graphique), className?.
 */
export function BarChart({ data, formatValue, height = 220, highlight, label = 'Graphique en barres', className }) {
  const items = data ?? []
  const format = formatValue ?? ((n) => new Intl.NumberFormat('fr-FR').format(n))
  const max = Math.max(0, ...items.map((item) => Number(item.value) || 0))
  const plotHeight = Math.max(40, height - VALUE_ROW - LABEL_ROW)

  if (items.length === 0) {
    return (
      <p className={styles.empty} style={{ minHeight: height }}>
        Aucune donnée à afficher.
      </p>
    )
  }

  return (
    <ul className={cx(styles.chart, highlight != null && styles.hasHighlight, className)} style={{ height }} aria-label={label}>
      {items.map((item, index) => {
        const value = Number(item.value) || 0
        const barHeight = max > 0 ? Math.max(value > 0 ? 3 : 1, Math.round((value / max) * plotHeight)) : 1
        return (
          <li key={`${item.label}-${index}`} className={cx(styles.item, index === highlight && styles.highlight)}>
            <span className={styles.value} data-numeric>
              {format(value)}
            </span>
            <span className={styles.bar} style={{ height: barHeight }} aria-hidden="true" />
            <span className={styles.label}>{item.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
