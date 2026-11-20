import { Search, X } from 'lucide-react'
import { cx } from './cx.js'
import styles from './controls.module.css'

/**
 * Champ de recherche avec icône et bouton d'effacement.
 * Props : value, onChange(valeurTexte), placeholder? (défaut « Rechercher… »),
 * ref?, + props natives de <input> (aria-label reprend le placeholder par défaut).
 */
export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className, ref, ...props }) {
  return (
    <span className={cx(styles.searchWrap, className)}>
      <Search className={styles.searchIcon} size={18} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className={cx(styles.control, styles.search)}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        {...props}
      />
      {value ? (
        <button type="button" className={styles.searchClear} onClick={() => onChange?.('')} aria-label="Effacer la recherche">
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  )
}
