import { cx } from './cx.js'
import { EmptyState } from './EmptyState.jsx'
import styles from './DataTable.module.css'

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]'

/**
 * Tableau de données avec états de chargement (squelette) et vide intégrés.
 * Props :
 *  - columns : [{ key, header, render?(row), align?: 'left'|'right'|'center', width? }]
 *    (sans render, la cellule affiche row[key])
 *  - rows, rowKey(row) → clé unique
 *  - loading? : affiche des lignes squelettes
 *  - empty? : nœud affiché quand rows est vide (défaut : « Aucun résultat »)
 *  - onRowClick?(row) : rend les lignes cliquables (clavier compris) ; les clics
 *    sur les boutons/liens d'une cellule ne déclenchent pas onRowClick
 *  - caption? : description lue par les lecteurs d'écran
 *  - mobileCards? : sous 640px, chaque ligne devient une carte « libellé : valeur »
 *    (sinon le tableau défile horizontalement)
 *  - skeletonRows? (défaut 5), minWidth? (largeur mini avant défilement, défaut '36rem'), className?
 */
export function DataTable({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  caption,
  mobileCards = false,
  skeletonRows = 5,
  minWidth = '36rem',
  className,
}) {
  const list = rows ?? []
  const isEmpty = !loading && list.length === 0

  return (
    <div className={cx(styles.wrap, mobileCards && styles.cards, className)}>
      <div className={styles.scroll} tabIndex={mobileCards ? undefined : 0} role={mobileCards ? undefined : 'group'} aria-label={mobileCards ? undefined : (caption ?? 'Tableau')}>
        <table className={styles.table} style={{ minWidth }} aria-busy={loading || undefined}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(styles.th, styles[column.align ?? 'left'])}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                  <tr key={`squelette-${rowIndex}`} className={styles.row} aria-hidden="true">
                    {columns.map((column, columnIndex) => (
                      <td key={column.key} className={cx(styles.td, styles[column.align ?? 'left'])}>
                        <span
                          className={styles.skeleton}
                          style={{ width: `${45 + ((rowIndex * 17 + columnIndex * 29) % 45)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {isEmpty ? (
              <tr>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  {empty ?? <EmptyState compact title="Aucun résultat" message="Aucune ligne à afficher pour le moment." />}
                </td>
              </tr>
            ) : null}
            {!loading
              ? list.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cx(styles.row, onRowClick && styles.clickable)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={
                      onRowClick
                        ? (event) => {
                            if (event.target.closest(INTERACTIVE)) return
                            onRowClick(row)
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(styles.td, styles[column.align ?? 'left'])}
                        data-label={typeof column.header === 'string' ? column.header : undefined}
                      >
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {loading ? <span className="sr-only" role="status">Chargement des données…</span> : null}
    </div>
  )
}
