import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Field, Input, PageLoader } from '../components/ui'
import { SupportLine } from '../features/shared/SupportLine.jsx'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { arrival } from '../lib/supabase.js'
import { hasErrors, validatePasswordChange } from '../lib/validation.js'
import styles from './auth.module.css'

const EMPTY = { password: '', confirmation: '' }

/**
 * Page d'arrivée du lien « mot de passe oublié » : la session a été ouverte par
 * le lien (supabase-js la lit dans l'adresse), il reste à choisir le nouveau
 * mot de passe. Sans session, ou si le lien a expiré, on propose d'en redemander un.
 */
export default function NewPasswordPage() {
  usePageTitle('Nouveau mot de passe')
  const navigate = useNavigate()
  const { user, loading, changePassword, finishPasswordRecovery } = useAuth()
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  const support = <SupportLine className={styles.support} />

  if (done) {
    return (
      <AuthLayout title="Mot de passe modifié" footer={support}>
        <div className={styles.form}>
          <Alert tone="success">Votre nouveau mot de passe est enregistré. Utilisez-le pour vos prochaines connexions.</Alert>
          <Button fullWidth onClick={() => navigate('/', { replace: true })}>
            Entrer dans l’application
          </Button>
        </div>
      </AuthLayout>
    )
  }

  // Lien expiré ou déjà utilisé (erreur dans l'adresse), ou page ouverte sans lien valide.
  if (arrival.error || (!loading && !user)) {
    return (
      <AuthLayout title="Lien expiré ou invalide" footer={support}>
        <div className={styles.form}>
          <Alert tone="warning" title="Ce lien ne permet plus de changer le mot de passe">
            Il a expiré, a déjà été utilisé, ou l’adresse est incomplète. Demandez un nouvel e-mail : le lien reste valable peu
            de temps et ne sert qu’une fois.
          </Alert>
          <Button as={Link} to="/mot-de-passe-oublie" fullWidth>
            Recevoir un nouveau lien
          </Button>
          <Button as={Link} to="/connexion" fullWidth variant="ghost">
            Retour à la connexion
          </Button>
        </div>
      </AuthLayout>
    )
  }
  if (!user) return <PageLoader />

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
      finishPasswordRecovery()
      setDone(true)
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle={`Choisissez le nouveau mot de passe du compte ${user.email}.`} footer={support}>
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        {/* Aide les gestionnaires de mots de passe à rattacher le nouveau mot de passe au bon compte. */}
        <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <Field label="Nouveau mot de passe" htmlFor="nouveau-mdp" required error={errors.password} hint="Entre 8 et 72 caractères.">
          <Input {...bind('password')} type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="nouveau-confirmation" required error={errors.confirmation}>
          <Input {...bind('confirmation')} type="password" autoComplete="new-password" />
        </Field>
        <Button type="submit" fullWidth loading={saving}>
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthLayout>
  )
}
