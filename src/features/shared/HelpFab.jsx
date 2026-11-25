import { useEffect, useId, useRef, useState } from 'react'
import { BookOpen, MessageCircleQuestionMark, MessageSquareHeart, Phone, X } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { SUPPORT } from '../../lib/support.js'
import { FeedbackModal } from '../feedback/FeedbackModal.jsx'
import styles from './HelpFab.module.css'

// Place réservée en bas des pages et sous les notifications, pour que le
// bouton ne recouvre jamais la dernière action d'une page ni un toast.
const RESERVED_SPACE = '4.5rem'

/** Logo WhatsApp (lucide n'a pas les logos de marque). Décoratif : le libellé est à côté. */
function WhatsAppIcon({ size = 20 }) {
  return (
    <svg className={styles.whatsapp} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/**
 * Bouton d'aide flottant, fixe en bas à droite de toutes les pages de
 * l'application (connecté ou non) : WhatsApp, appel, guide et, pour un membre
 * d'une pharmacie, « Donner mon avis ». Il passe sous les fenêtres modales.
 */
export function HelpFab() {
  const { isStaff } = useAuth()
  const panelId = useId()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const firstItemRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Les pages et la zone des notifications lisent cette variable pour laisser la place du bouton.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--help-fab-space', RESERVED_SPACE)
    return () => root.style.removeProperty('--help-fab-space')
  }, [])

  // Panneau ouvert : focus sur la première action ; Échap ou clic à l'extérieur le ferment.
  useEffect(() => {
    if (!open) return undefined
    firstItemRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const openFeedback = () => {
    setOpen(false)
    setFeedbackOpen(true)
  }
  const closeFeedback = () => {
    setFeedbackOpen(false)
    // Après la fermeture de la fenêtre (qui rend le focus à un élément disparu), retour au bouton.
    setTimeout(() => buttonRef.current?.focus(), 0)
  }
  const Icon = open ? X : MessageCircleQuestionMark

  return (
    <div className={styles.root} ref={rootRef}>
      {open ? (
        <div className={styles.panel} id={panelId} role="group" aria-label="Aide et assistance">
          <p className={styles.title}>Besoin d’aide ?</p>
          <a ref={firstItemRef} className={styles.item} href={SUPPORT.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <WhatsAppIcon />
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>WhatsApp</span>
              <span className={styles.itemHint}>Écrire à l’assistance</span>
            </span>
          </a>
          <a className={styles.item} href={SUPPORT.telHref} onClick={() => setOpen(false)}>
            <Phone size={20} aria-hidden="true" className={styles.itemIcon} />
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>Appeler</span>
              <span className={styles.itemHint} data-numeric>
                {SUPPORT.phone}
              </span>
            </span>
          </a>
          <a className={styles.item} href={SUPPORT.guideHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <BookOpen size={20} aria-hidden="true" className={styles.itemIcon} />
            <span className={styles.itemLabel}>Guide d’utilisation (PDF)</span>
          </a>
          {isStaff ? (
            <button type="button" className={styles.item} onClick={openFeedback}>
              <MessageSquareHeart size={20} aria-hidden="true" className={styles.itemIcon} />
              <span className={styles.itemLabel}>Donner mon avis</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={open ? 'Fermer l’aide' : 'Besoin d’aide ?'}
        title={open ? 'Fermer l’aide' : 'Besoin d’aide ?'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={24} aria-hidden="true" />
      </button>

      {isStaff ? <FeedbackModal open={feedbackOpen} onClose={closeFeedback} /> : null}
    </div>
  )
}
