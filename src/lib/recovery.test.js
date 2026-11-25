import { describe, expect, it } from 'vitest'
import { parseRecoveryUrl } from './recovery.js'

describe('parseRecoveryUrl', () => {
  it('reconnaît un lien de récupération (flux implicite, dans le fragment)', () => {
    const hash = '#access_token=abc.def.ghi&expires_in=3600&refresh_token=xyz&token_type=bearer&type=recovery'
    expect(parseRecoveryUrl({ hash, search: '' })).toEqual({ recovery: true, error: null })
  })
  it('reconnaît aussi les paramètres placés après « ? »', () => {
    expect(parseRecoveryUrl({ hash: '', search: '?code=1234&type=recovery' })).toEqual({ recovery: true, error: null })
  })
  it('lien expiré ou déjà utilisé', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    expect(parseRecoveryUrl({ hash })).toEqual({ recovery: false, error: 'expired' })
    expect(parseRecoveryUrl({ search: '?error=access_denied&error_description=x' })).toEqual({ recovery: false, error: 'expired' })
  })
  it('autre erreur renvoyée par le service', () => {
    expect(parseRecoveryUrl({ hash: '#error=server_error&error_description=boom' })).toEqual({ recovery: false, error: 'other' })
  })
  it('une erreur l’emporte sur un type « recovery »', () => {
    expect(parseRecoveryUrl({ hash: '#error_code=otp_expired&type=recovery&access_token=x' })).toEqual({ recovery: false, error: 'expired' })
  })
  it('adresse ordinaire, autre type de lien ou jeton absent : rien', () => {
    expect(parseRecoveryUrl({ hash: '', search: '' })).toEqual({ recovery: false, error: null })
    expect(parseRecoveryUrl()).toEqual({ recovery: false, error: null })
    expect(parseRecoveryUrl({ hash: '#access_token=x&type=signup' })).toEqual({ recovery: false, error: null })
    expect(parseRecoveryUrl({ hash: '#type=recovery' })).toEqual({ recovery: false, error: null })
    expect(parseRecoveryUrl({ search: '?etat=ok' })).toEqual({ recovery: false, error: null })
  })
})
