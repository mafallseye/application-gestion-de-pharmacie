import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Field, Input, PageLoader } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { hasErrors, validateLogin } from '../lib/validation.js'
import styles from './auth.module.css'

export default function LoginPage() {
  usePageTitle('Connexion')
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Déjà connecté (ou connexion réussie) : retour à la page demandée.
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />
  if (loading) return <PageLoader />

  const bind = (name) => ({
    name,
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const result = validateLogin(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) return
    setSubmitting(true)
    try {
      await signIn(result.values.email, result.values.password)
    } catch (error) {
      setServerError(errorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Entrez vos identifiants pour ouvrir votre session."
      footer="Pas encore de compte ? Demandez à l’administrateur de la pharmacie de vous en créer un."
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <Field label="Adresse e-mail" htmlFor="connexion-email" error={errors.email}>
          <Input {...bind('email')} type="email" autoComplete="username" placeholder="prenom.nom@exemple.sn" />
        </Field>
        <Field label="Mot de passe" htmlFor="connexion-mdp" error={errors.password}>
          <Input {...bind('password')} type="password" autoComplete="current-password" />
        </Field>
        <Button type="submit" fullWidth loading={submitting}>
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  )
}
