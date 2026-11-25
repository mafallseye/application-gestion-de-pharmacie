import { useState } from 'react'
import { BookOpen, MessageCircle, MessageSquareHeart, Phone } from 'lucide-react'
import { SUPPORT } from '../../lib/support.js'
import { FeedbackModal } from '../feedback/FeedbackModal.jsx'
import styles from './HelpBlock.module.css'

/**
 * Bloc d'aide du pied de la barre latérale, pour tous les rôles : appeler ou
 * écrire à l'assistance, ouvrir le guide, donner son avis sur l'application.
 */
export function HelpBlock() {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  return (
    <section className={styles.block} aria-labelledby="aide-titre">
      <h2 className={styles.title} id="aide-titre">
        Besoin d’aide ?
      </h2>
      <div className={styles.links}>
        <a className={styles.link} href={SUPPORT.telHref} title={`Appeler le ${SUPPORT.phone}`}>
          <Phone size={15} aria-hidden="true" />
          Appeler
        </a>
        <a className={styles.link} href={SUPPORT.whatsappHref} target="_blank" rel="noopener noreferrer" title={`WhatsApp : ${SUPPORT.phone}`}>
          <MessageCircle size={15} aria-hidden="true" />
          WhatsApp
        </a>
      </div>
      <p className={styles.phone}>{SUPPORT.phone}</p>
      <a className={styles.row} href={SUPPORT.guideHref} target="_blank" rel="noopener noreferrer">
        <BookOpen size={15} aria-hidden="true" />
        Guide d’utilisation (PDF)
      </a>
      <button type="button" className={styles.row} onClick={() => setFeedbackOpen(true)}>
        <MessageSquareHeart size={15} aria-hidden="true" />
        Donner mon avis
      </button>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </section>
  )
}
