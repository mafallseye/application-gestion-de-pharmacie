import { SUPPORT } from '../../lib/support.js'
import styles from './SupportLine.module.css'

/**
 * Ligne discrète « Besoin d'aide ? » : appel, WhatsApp et, si `guide`, le guide
 * d'utilisation. Pour les écrans hors session, les erreurs et la page Abonnement.
 */
export function SupportLine({ guide = false, className }) {
  return (
    <p className={[styles.line, className].filter(Boolean).join(' ')}>
      Besoin d’aide ? <a href={SUPPORT.telHref}>Appeler le {SUPPORT.phone}</a> ou{' '}
      <a href={SUPPORT.whatsappHref} target="_blank" rel="noopener noreferrer">
        écrire sur WhatsApp
      </a>
      .
      {guide ? (
        <>
          {' '}
          <a href={SUPPORT.guideHref} target="_blank" rel="noopener noreferrer">
            Guide d’utilisation (PDF)
          </a>
        </>
      ) : null}
    </p>
  )
}
