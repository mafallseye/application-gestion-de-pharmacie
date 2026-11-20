import { cx } from './cx.js'
import { Spinner } from './Spinner.jsx'
import styles from './Button.module.css'

/**
 * Bouton d'action.
 * Props : variant 'primary'|'secondary'|'ghost'|'danger' (défaut 'primary'),
 * size 'sm'|'md' (défaut 'md'), icon? (composant lucide, placé avant le texte),
 * loading? (désactive le bouton et affiche un spinner), type (défaut 'button'),
 * fullWidth? (occupe toute la largeur), as? (élément ou composant à rendre à la
 * place de <button>, ex. Link), + toutes les props natives.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  type = 'button',
  fullWidth = false,
  as: Component = 'button',
  className,
  disabled,
  children,
  ...props
}) {
  const isButton = Component === 'button'
  return (
    <Component
      type={isButton ? type : undefined}
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className)}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 16 : 18} label="" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2} aria-hidden="true" className={styles.icon} />
      ) : null}
      {children != null && children !== false ? <span className={styles.label}>{children}</span> : null}
    </Component>
  )
}
