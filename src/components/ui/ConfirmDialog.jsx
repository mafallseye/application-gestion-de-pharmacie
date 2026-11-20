import { useRef } from 'react'
import { Button } from './Button.jsx'
import { Modal } from './Modal.jsx'
import styles from './ConfirmDialog.module.css'

/**
 * Demande de confirmation avant une action (suppression par défaut).
 * Props : open, title, message (texte ou nœud), confirmLabel (défaut « Supprimer »),
 * cancelLabel (défaut « Annuler »), danger (défaut true : bouton rouge),
 * loading? (action en cours : bloque la fermeture), onConfirm, onCancel.
 * Le focus se place sur « Annuler » à l'ouverture.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      dismissible={!loading}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.message}>{message}</div>
    </Modal>
  )
}
