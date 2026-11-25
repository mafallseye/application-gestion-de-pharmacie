import { describe, expect, it } from 'vitest'
import {
  INITIAL_MOBILE_PAYMENT,
  isFinalPhase,
  mobilePaymentOutcome,
  mobilePaymentReducer,
  paymentMethodLabel,
  pendingMobilePayment,
} from './mobilePayment.js'

const play = (...events) => events.reduce(mobilePaymentReducer, INITIAL_MOBILE_PAYMENT)
const status = (value) => ({ type: 'status', status: value })

describe('mobilePaymentReducer', () => {
  it('reste en attente tant que le paiement est « pending », en comptant les vérifications', () => {
    expect(play(status('pending'), status('pending'))).toEqual({ phase: 'waiting', checks: 2, error: null })
  })
  it('passe à chaque état final', () => {
    for (const final of ['completed', 'cancelled', 'sale_cancelled', 'review', 'unknown']) {
      expect(play(status('pending'), status(final)).phase).toBe(final)
      expect(isFinalPhase(final)).toBe(true)
    }
    expect(isFinalPhase('waiting')).toBe(false)
    expect(isFinalPhase('error')).toBe(false)
  })
  it('un état final est définitif (une réponse tardive est ignorée)', () => {
    const done = play(status('completed'))
    expect(mobilePaymentReducer(done, status('pending'))).toBe(done)
    expect(mobilePaymentReducer(done, { type: 'failure', message: 'x' })).toBe(done)
    expect(mobilePaymentReducer(done, { type: 'retry' })).toBe(done)
  })
  it('« error » ou appel en échec : pause, puis reprise à la demande', () => {
    expect(play(status('error'))).toEqual({ phase: 'error', checks: 1, error: null })
    const failed = play({ type: 'failure', message: 'Connexion impossible.' })
    expect(failed).toEqual({ phase: 'error', checks: 1, error: 'Connexion impossible.' })
    expect(mobilePaymentReducer(failed, { type: 'retry' })).toEqual({ phase: 'waiting', checks: 2, error: null })
  })
  it('« retry » sans erreur ne change rien ; un statut inattendu est traité comme une erreur', () => {
    expect(mobilePaymentReducer(INITIAL_MOBILE_PAYMENT, { type: 'retry' })).toBe(INITIAL_MOBILE_PAYMENT)
    expect(play(status('bizarre')).phase).toBe('error')
  })
  it('payé pendant l’annulation : la réponse « completed » affiche le succès', () => {
    expect(play(status('pending'), status('completed')).phase).toBe('completed')
  })
})

describe('mobilePaymentOutcome', () => {
  it('donne un message à chaque phase', () => {
    expect(mobilePaymentOutcome('waiting').title).toBe('En attente du paiement du client…')
    expect(mobilePaymentOutcome('completed').message).toBe('La vente est payée.')
    expect(mobilePaymentOutcome('completed', { wholeSale: false }).message).toBe('Le paiement a été ajouté à la vente.')
    expect(mobilePaymentOutcome('sale_cancelled').message).toMatch(/stock a été rendu/)
    expect(mobilePaymentOutcome('cancelled').title).toBe('Demande de paiement annulée')
    expect(mobilePaymentOutcome('unknown').tone).toBe('danger')
  })
  it('« review » : argent reçu, jamais présenté comme un échec', () => {
    const outcome = mobilePaymentOutcome('review')
    expect(outcome.tone).toBe('info')
    expect(`${outcome.title} ${outcome.message}`).toMatch(/contrôle manuel/)
    expect(`${outcome.title} ${outcome.message}`).not.toMatch(/échou/i)
  })
  it('erreur : message du serveur s’il y en a un, sinon message par défaut', () => {
    expect(mobilePaymentOutcome('error', { error: 'Votre abonnement a expiré.' }).message).toBe('Votre abonnement a expiré.')
    expect(mobilePaymentOutcome('error').message).toMatch(/Réessayez/)
  })
})

describe('libellés et demande en attente', () => {
  it('mode de paiement', () => {
    expect(paymentMethodLabel('cash')).toBe('Espèces')
    expect(paymentMethodLabel('mobile')).toBe('Mobile money')
    expect(paymentMethodLabel(undefined)).toBe('Espèces')
  })
  it('retrouve la demande mobile en attente d’une vente', () => {
    const pending = { id: 2, status: 'pending' }
    expect(pendingMobilePayment({ mobile_payments: [{ id: 1, status: 'cancelled' }, pending] })).toBe(pending)
    expect(pendingMobilePayment({ mobile_payments: [{ id: 1, status: 'completed' }] })).toBeNull()
    expect(pendingMobilePayment({})).toBeNull()
    expect(pendingMobilePayment(null)).toBeNull()
  })
})
