import { describe, expect, it } from 'vitest'
import { SUPPORT, SUPPORT_CONTACT } from './support.js'

describe('assistance', () => {
  it('le numéro affiché et les liens désignent le même numéro sénégalais', () => {
    const digits = SUPPORT.phone.replace(/\D/g, '')
    expect(digits).toBe('781235011')
    expect(SUPPORT.telHref).toBe('tel:+221781235011')
    expect(SUPPORT.whatsappHref).toBe('https://wa.me/221781235011')
    expect(SUPPORT.telHref.endsWith(digits) && SUPPORT.whatsappHref.endsWith(digits)).toBe(true)
  })
  it('le guide est un fichier du site', () => {
    expect(SUPPORT.guideHref).toBe('/guide-utilisation.pdf')
  })
  it('la formule à insérer dans les messages cite le numéro', () => {
    expect(SUPPORT_CONTACT).toBe('l’assistance au 78 123 50 11 (appel ou WhatsApp)')
  })
})
