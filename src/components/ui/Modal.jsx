import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cx } from './cx.js'
import { IconButton } from './IconButton.jsx'
import styles from './Modal.module.css'

/**
 * Fenêtre modale accessible, basée sur <dialog> natif (piège de focus, Échap,
 * clic sur le fond, retour du focus à la fermeture).
 * Props : open, onClose, title, children, footer? (nœud : boutons d'action),
 * size? 'sm'|'md'|'lg' (défaut 'md'), description? (texte sous le titre),
 * dismissible? (défaut true ; false bloque Échap/fond/croix, ex. pendant un envoi),
 * initialFocusRef? (élément à focaliser à l'ouverture ; par défaut le premier champ),
 * role? (défaut 'dialog').
 * Le contenu n'est monté que lorsque la modale est ouverte.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  description,
  dismissible = true,
  initialFocusRef,
  role,
}) {
  const dialogRef = useRef(null)
  const bodyRef = useRef(null)
  const pressStartedOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      const target =
        initialFocusRef?.current ??
        bodyRef.current?.querySelector(
          '[data-autofocus], input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        )
      target?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocusRef])

  const requestClose = () => {
    if (dismissible) onClose?.()
  }

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.dialog, styles[size])}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClose={() => {
        if (open) onClose?.()
      }}
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressStartedOnBackdrop.current) requestClose()
        pressStartedOnBackdrop.current = false
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
              {description ? (
                <p className={styles.description} id={descriptionId}>
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton icon={X} label="Fermer" onClick={requestClose} disabled={!dismissible} className={styles.close} />
          </header>
          <div className={styles.body} ref={bodyRef}>
            {children}
          </div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  )
}
