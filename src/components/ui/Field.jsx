import { cloneElement, isValidElement } from 'react'
import { CircleAlert } from 'lucide-react'
import styles from './Field.module.css'

/**
 * Enveloppe d'un champ de formulaire : libellé, contrôle, aide et message d'erreur.
 * Props : label, htmlFor (id du contrôle), error? (texte), hint? (texte d'aide),
 * required? (affiche l'astérisque), children (le contrôle), className?.
 * Si children est un élément unique, Field lui ajoute id (s'il manque),
 * aria-describedby, aria-invalid et aria-required automatiquement.
 */
export function Field({ label, htmlFor, error, hint, required = false, className, children }) {
  const errorId = error && htmlFor ? `${htmlFor}-erreur` : undefined
  const hintId = hint && htmlFor ? `${htmlFor}-aide` : undefined

  let control = children
  if (isValidElement(children)) {
    const describedBy = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ')
    control = cloneElement(children, {
      id: children.props.id ?? htmlFor,
      'aria-describedby': describedBy || undefined,
      'aria-invalid': error ? true : children.props['aria-invalid'],
      'aria-required': required ? true : children.props['aria-required'],
    })
  }

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint && !error ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId}>
          <CircleAlert size={14} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
