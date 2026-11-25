import { describe, expect, it } from 'vitest'
import { canVerify, paymentBadge, paymentOutcome, paymentsToRecheck } from './payments.js'

describe('paymentBadge', () => {
  it('donne un libellé lisible à chaque statut en base', () => {
    expect(paymentBadge('completed')).toEqual({ tone: 'success', label: 'Payé' })
    expect(paymentBadge('pending').label).toBe('En attente')
    expect(paymentBadge('review')).toEqual({ tone: 'info', label: 'À vérifier' })
    expect(paymentBadge('cancelled').label).toBe('Annulé')
    expect(paymentBadge('failed').label).toBe('Échoué')
    expect(paymentBadge('autre').label).toBe('Inconnu')
  })
})

describe('paymentOutcome', () => {
  it('propose de revérifier seulement « en attente » et « erreur »', () => {
    const retry = Object.fromEntries(
      ['completed', 'pending', 'review', 'error', 'cancelled', 'failed', 'unknown'].map((s) => [s, paymentOutcome(s).retry]),
    )
    expect(retry).toEqual({ completed: false, pending: true, review: false, error: true, cancelled: false, failed: false, unknown: false })
  })
  it('« review » : paiement reçu, jamais présenté comme un échec', () => {
    const outcome = paymentOutcome('review')
    expect(outcome.tone).not.toBe('danger')
    expect(outcome.message).toBe(
      'Paiement reçu. Sa validation demande une vérification manuelle : contactez l’assistance au 78 123 50 11 (appel ou WhatsApp), votre abonnement sera activé après contrôle.',
    )
    expect(`${outcome.title} ${outcome.message}`).not.toMatch(/échou/i)
  })
  it('« error » invite à réessayer', () => {
    expect(paymentOutcome('error').message).toBe('La vérification est momentanément impossible. Réessayez dans un instant.')
  })
  it('statut inconnu ou absent : paiement introuvable', () => {
    expect(paymentOutcome('unknown').title).toBe('Paiement introuvable')
    expect(paymentOutcome(undefined).title).toBe('Paiement introuvable')
  })
})

describe('canVerify / paymentsToRecheck', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  const payment = (overrides) => ({ id: 1, status: 'pending', provider_token: 'abc123', created_at: '2026-11-21T10:00:00Z', ...overrides })

  it('vérifiable : en attente avec une référence', () => {
    expect(canVerify(payment())).toBe(true)
    expect(canVerify(payment({ provider_token: null }))).toBe(false)
    expect(canVerify(payment({ status: 'review' }))).toBe(false)
    expect(canVerify(payment({ status: 'completed' }))).toBe(false)
  })
  it('ne revérifie d’office que les paiements en attente de moins de 48 h', () => {
    const list = [
      payment({ id: 1 }),
      payment({ id: 2, created_at: '2026-11-19T12:00:01Z' }), // 47 h 59
      payment({ id: 3, created_at: '2026-11-19T12:00:00Z' }), // 48 h pile : trop ancien
      payment({ id: 4, provider_token: null }),
      payment({ id: 5, status: 'failed' }),
      payment({ id: 6, status: 'completed' }),
    ]
    expect(paymentsToRecheck(list, now).map((p) => p.id)).toEqual([1, 2])
    expect(paymentsToRecheck(undefined, now)).toEqual([])
  })
})
