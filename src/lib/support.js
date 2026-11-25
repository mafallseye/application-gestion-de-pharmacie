// Assistance : un seul endroit pour le numéro (appel et WhatsApp Business) et le guide.

const COUNTRY_CODE = '221' // Sénégal
const LOCAL_NUMBER = '781235011'

export const SUPPORT = {
  /** Numéro tel qu'on l'écrit au Sénégal. */
  phone: '78 123 50 11',
  /** Lien d'appel (format international). */
  telHref: `tel:+${COUNTRY_CODE}${LOCAL_NUMBER}`,
  /** Conversation WhatsApp avec l'assistance. */
  whatsappHref: `https://wa.me/${COUNTRY_CODE}${LOCAL_NUMBER}`,
  /** Guide d'utilisation, servi tel quel depuis public/. */
  guideHref: '/guide-utilisation.pdf',
}

/** Phrase à insérer dans un message : « l'assistance au 78 123 50 11 (appel ou WhatsApp) ». */
export const SUPPORT_CONTACT = `l’assistance au ${SUPPORT.phone} (appel ou WhatsApp)`
