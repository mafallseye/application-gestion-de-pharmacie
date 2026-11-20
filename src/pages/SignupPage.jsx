import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Field, Input, PageLoader } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { hasErrors, validateSignup } from '../lib/validation.js'
import styles from './auth.module.css'

const EMPTY = { full_name: '', email: '', password: '', confirmation: '' }

/** Inscription du futur administrateur d'une pharmacie (la pharmacie se crée à l'étape suivante). */
export default function SignupPage() {
  usePageTitle('Créer un compte')
  const { user, loading, signUp } = useAuth()
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // Adresse à confirmer : le projet exige un clic dans l'e-mail avant la première connexion.
  const [confirmEmail, setConfirmEmail] = useState(null)

  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  // Compte créé et session ouverte : la suite (création de la pharmacie) est gérée par les gardes.
  if (user) return <Navigate to="/" replace />
  if (loading) return <PageLoader />

  if (confirmEmail) {
    return (
      <AuthLayout
        title="Vérifiez votre boîte mail"
        subtitle={`Un message a été envoyé à ${confirmEmail}.`}
        footer={<Link to="/connexion">Aller à la connexion</Link>}
      >
        <Alert tone="success" title="Compte créé">
          Cliquez sur le lien reçu par e-mail pour confirmer votre adresse, puis connectez-vous pour créer votre pharmacie.
          Pensez à regarder dans les courriers indésirables.
        </Alert>
      </AuthLayout>
    )
  }

  const bind = (name) => ({
    name,
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const result = validateSignup(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    setSubmitting(true)
    try {
      const { needsConfirmation } = await signUp(result.values)
      if (needsConfirmation) setConfirmEmail(result.values.email)
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Inscrivez votre pharmacie : 14 jours d’essai gratuit, sans engagement."
      footer={
        <>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </>
      }
    >
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <Field label="Nom complet" htmlFor="inscription-nom" required error={errors.full_name}>
          <Input {...bind('full_name')} autoComplete="name" placeholder="ex. Awa Ndiaye" maxLength={120} />
        </Field>
        <Field label="Adresse e-mail" htmlFor="inscription-email" required error={errors.email}>
          <Input {...bind('email')} type="email" autoComplete="username" placeholder="prenom.nom@exemple.sn" />
        </Field>
        <Field label="Mot de passe" htmlFor="inscription-mdp" required error={errors.password} hint="Entre 8 et 72 caractères.">
          <Input {...bind('password')} type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="inscription-confirmation" required error={errors.confirmation}>
          <Input {...bind('confirmation')} type="password" autoComplete="new-password" />
        </Field>
        <Button type="submit" fullWidth loading={submitting}>
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  )
}
