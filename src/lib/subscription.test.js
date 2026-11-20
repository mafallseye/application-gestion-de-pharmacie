import { describe, expect, it } from 'vitest'
import { subscriptionState } from './subscription.js'

const now = new Date('2026-11-21T12:00:00Z')
const state = (trial, paid = null) => subscriptionState({ trial_ends_at: trial, subscription_ends_at: paid }, now)

describe('subscriptionState', () => {
  it('essai en cours', () => {
    expect(state('2026-12-05T12:00:00Z')).toEqual({
      status: 'trial',
      endsAt: new Date('2026-12-05T12:00:00Z'),
      daysLeft: 14,
      canWrite: true,
      endingSoon: false,
    })
  })
  it('compte les jours entamés', () => {
    expect(state('2026-11-21T12:00:01Z').daysLeft).toBe(1)
    expect(state('2026-11-22T12:00:00Z').daysLeft).toBe(1)
    expect(state('2026-11-22T12:00:01Z').daysLeft).toBe(2)
  })
  it('bientôt expiré : 5 jours ou moins', () => {
    expect(state('2026-11-26T12:00:00Z').endingSoon).toBe(true)
    expect(state('2026-11-26T12:00:01Z').endingSoon).toBe(false)
  })
  it('expiré : essai dépassé, sans abonnement', () => {
    expect(state('2026-11-20T12:00:00Z')).toEqual({
      status: 'expired',
      endsAt: new Date('2026-11-20T12:00:00Z'),
      daysLeft: 0,
      canWrite: false,
      endingSoon: false,
    })
    // À l'instant exact de la fin, l'accès est terminé (comme en base : fin > maintenant).
    expect(state('2026-11-21T12:00:00Z').canWrite).toBe(false)
  })
  it('abonnement en cours après un essai terminé', () => {
    const result = state('2026-11-01T00:00:00Z', '2026-12-21T12:00:00Z')
    expect(result.status).toBe('active')
    expect(result.daysLeft).toBe(30)
    expect(result.canWrite).toBe(true)
  })
  it('abonnement expiré', () => {
    expect(state('2026-01-01T00:00:00Z', '2026-11-20T00:00:00Z').status).toBe('expired')
  })
  it('la date la plus tardive l’emporte', () => {
    // Abonnement plus court que l'essai restant : l'essai continue de donner accès.
    const result = state('2026-12-05T12:00:00Z', '2026-11-25T00:00:00Z')
    expect(result.status).toBe('trial')
    expect(result.endsAt).toEqual(new Date('2026-12-05T12:00:00Z'))
  })
  it('sans pharmacie ou sans date : lecture seule', () => {
    expect(subscriptionState(null, now).canWrite).toBe(false)
    expect(subscriptionState({}, now).status).toBe('expired')
    expect(subscriptionState({ trial_ends_at: 'pas une date' }, now).endsAt).toBeNull()
  })
})
