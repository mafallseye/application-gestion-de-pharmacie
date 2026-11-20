import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Field, FormGrid, Input, PageHeader, Stack, useToast } from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { errorMessage } from '../../lib/errors.js'
import { ROLE_LABELS, hasErrors, validatePasswordChange } from '../../lib/validation.js'
import { usePageTitle } from '../shared/usePageTitle.js'
import styles from './AccountPage.module.css'

const EMPTY = { password: '', confirmation: '' }

export default function AccountPage() {
  usePageTitle('Mon compte')
  const toast = useToast()
  const { profile, changePassword } = useAuth()
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Après un envoi refusé, le focus va au premier champ en erreur.
  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  const bind = (name) => ({
    name,
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const result = validatePasswordChange(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    setSaving(true)
    try {
      await changePassword(result.values.password)
      setForm(EMPTY)
      toast.success('Mot de passe modifié.')
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Mon compte" subtitle="Vos informations et votre mot de passe." />
      <Stack gap="var(--space-4)">
        <Card title="Informations" subtitle="Seul un administrateur peut modifier votre nom ou votre rôle.">
          <dl className={styles.identity}>
            <div>
              <dt>Nom</dt>
              <dd>{profile.full_name || '—'}</dd>
            </div>
            <div>
              <dt>Adresse e-mail</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>{ROLE_LABELS[profile.role] ?? profile.role}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Changer mon mot de passe">
          <form ref={formRef} onSubmit={submit} noValidate className={styles.form}>
            {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
            {/* Aide les gestionnaires de mots de passe à rattacher le nouveau mot de passe au bon compte. */}
            <input type="text" name="username" autoComplete="username" value={profile.email} readOnly hidden />
            <FormGrid>
              <Field label="Nouveau mot de passe" htmlFor="compte-mdp" required error={errors.password} hint="Entre 8 et 72 caractères.">
                <Input {...bind('password')} type="password" autoComplete="new-password" />
              </Field>
              <Field label="Confirmer le mot de passe" htmlFor="compte-confirmation" required error={errors.confirmation}>
                <Input {...bind('confirmation')} type="password" autoComplete="new-password" />
              </Field>
            </FormGrid>
            <div>
              <Button type="submit" loading={saving}>
                Changer le mot de passe
              </Button>
            </div>
          </form>
        </Card>
      </Stack>
    </>
  )
}
