import { describe, expect, it } from 'vitest'
import { AppError, errorMessage, functionError, toAppError, unwrap } from './errors.js'

describe('errorMessage', () => {
  it("traduit une violation d'unicité", () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "categories_name_key"' }
    expect(errorMessage(error)).toBe('Cet élément existe déjà.')
    expect(errorMessage(error, { 23505: 'Une catégorie porte déjà ce nom.' })).toBe('Une catégorie porte déjà ce nom.')
  })
  it('traduit une violation de clé étrangère', () => {
    expect(errorMessage({ code: '23503', message: 'violates foreign key constraint' })).toMatch(/élément lié/)
  })
  it('traduit une contrainte CHECK', () => {
    expect(errorMessage({ code: '23514', message: 'violates check constraint' })).toMatch(/ne sont pas valides/)
  })
  it('traduit les refus de droits natifs (RLS, privilèges)', () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy for table "medicines"' }
    const grant = { code: '42501', message: 'permission denied for table sales' }
    expect(errorMessage(rls)).toMatch(/droits nécessaires/)
    expect(errorMessage(grant)).toMatch(/droits nécessaires/)
    expect(errorMessage({ code: '42501' })).toMatch(/droits nécessaires/)
  })
  it('transmet tels quels les messages métier du schéma', () => {
    const stock = { code: '22023', message: 'Stock insuffisant pour « Doliprane » (3 en stock).' }
    const self = { code: '42501', message: 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.' }
    expect(errorMessage(stock)).toBe(stock.message)
    expect(errorMessage(self)).toBe(self.message)
    expect(errorMessage({ code: '42501', message: 'Accès refusé.' })).toBe('Accès refusé.')
  })
  it('traduit les erreurs réseau', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Connexion au serveur impossible/)
    expect(errorMessage({ name: 'AuthRetryableFetchError', message: '', status: 0 })).toMatch(/Connexion au serveur/)
    expect(errorMessage({ message: 'TypeError: NetworkError when attempting to fetch resource.' })).toMatch(
      /Connexion au serveur/,
    )
  })
  it('traduit les identifiants de connexion invalides', () => {
    const expected = 'Adresse e-mail ou mot de passe incorrect.'
    expect(errorMessage({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toBe(expected)
    expect(errorMessage({ status: 400, message: 'Invalid login credentials' })).toBe(expected)
  })
  it('traduit session expirée, limite de débit et ligne introuvable', () => {
    expect(errorMessage({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/session a expiré/)
    expect(errorMessage({ status: 429, message: 'rate limit' })).toMatch(/Trop de tentatives/)
    expect(errorMessage({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toMatch(
      /introuvable/,
    )
  })
  it('traduit les refus de changement de mot de passe', () => {
    expect(errorMessage({ code: 'same_password', status: 422, message: 'New password should be different' })).toMatch(
      /différent de l'ancien/,
    )
    expect(errorMessage({ code: 'weak_password', status: 422, message: 'Password is too weak' })).toMatch(/trop faible/)
  })
  it('transmet le message « prix ont changé » de create_sale', () => {
    const message = 'Les prix ont changé : le total est maintenant de 5400 FCFA. Vérifiez le panier.'
    expect(errorMessage({ code: '22023', message })).toBe(message)
  })
  it('traduit la limite d’envoi des e-mails', () => {
    expect(errorMessage({ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' })).toBe(
      'Trop de demandes. Réessayez dans quelques minutes.',
    )
  })
  it("n'affiche jamais un message technique inconnu", () => {
    const generic = 'Une erreur est survenue. Réessayez.'
    expect(errorMessage({ code: '42703', message: 'column "foo" does not exist' })).toBe(generic)
    expect(errorMessage(new Error("Cannot read properties of null (reading 'from')"))).toBe(generic)
    expect(errorMessage({ code: '22P02', message: 'invalid input syntax for type integer: "x"' })).not.toMatch(/syntax/)
    expect(errorMessage(null)).toBe(generic)
    expect(errorMessage('boom')).toBe(generic)
  })
  it('rend le message des AppError sans le retraduire', () => {
    expect(errorMessage(new AppError('Déjà en français.'))).toBe('Déjà en français.')
  })
})

describe('toAppError / unwrap', () => {
  it('conserve le code et la cause', () => {
    const cause = { code: '23505', message: 'duplicate key' }
    const error = toAppError(cause)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('23505')
    expect(error.cause).toBe(cause)
    expect(error.retryable).toBe(false)
    expect(toAppError(error)).toBe(error)
  })
  it('marque les pannes réseau et serveur comme réessayables', () => {
    expect(toAppError(new TypeError('Failed to fetch')).retryable).toBe(true)
    expect(toAppError({ status: 503, message: 'upstream' }).retryable).toBe(true)
  })
  it('unwrap renvoie data ou lève une AppError', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1])
    expect(() => unwrap({ data: null, error: { code: '23505', message: 'x' } }, { 23505: 'Doublon.' })).toThrow('Doublon.')
  })
})

describe('functionError', () => {
  const httpError = (status, body) => ({
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(body, { status }),
  })

  it('reprend le message { error } de la fonction Edge', async () => {
    const error = await functionError(httpError(409, JSON.stringify({ error: 'Cette adresse e-mail est déjà utilisée.' })))
    expect(error).toBeInstanceOf(AppError)
    expect(error.message).toBe('Cette adresse e-mail est déjà utilisée.')
  })
  it('retombe sur un message selon le statut sans JSON exploitable', async () => {
    expect((await functionError(httpError(403, 'Forbidden'))).message).toMatch(/droits nécessaires/)
    expect((await functionError(httpError(401, JSON.stringify({ message: 'Invalid JWT' })))).message).toMatch(/session/)
    expect((await functionError(httpError(404, '{}'))).message).toMatch(/indisponible/)
    expect((await functionError(httpError(500, 'boom'))).message).toMatch(/indisponible/)
  })
  it('traduit une panne réseau', async () => {
    const error = await functionError({ name: 'FunctionsFetchError', message: 'Failed to send a request' })
    expect(error.message).toMatch(/Connexion au serveur impossible/)
  })
})
