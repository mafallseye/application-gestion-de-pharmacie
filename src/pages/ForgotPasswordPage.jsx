import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Field, Input } from '../components/ui'
import { SupportLine } from '../features/shared/SupportLine.jsx'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { hasErrors, validateEmailAddress } from '../lib/validation.js'
import styles from './auth.module.css'

/** « Mot de passe oublié ? » : envoi d'un lien de réinitialisation par e-mail. */
export default function ForgotPasswordPage() {
  usePageTitle('Mot de passe oublié')
  const { requestPasswordReset } = useAuth()
  const formRef = useRef(null)
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  const footer = (
    <>
      <Link to="/connexion">Retour à la connexion</Link>
      <SupportLine className={styles.support} />
    </>
  )

  if (sent) {
    return (
      <AuthLayout title="Vérifiez votre boîte mail" footer={footer}>
        <div className={styles.form}>
          {/* Même message que le compte existe ou non : on ne révèle pas qui est inscrit. */}
          <Alert tone="success">
            Si un compte existe pour cette adresse, un e-mail vient de vous être envoyé. Ouvrez-le et cliquez sur le lien pour
            choisir un nouveau mot de passe. Pensez à regarder les courriers indésirables.
          </Alert>
          <Button as={Link} to="/connexion" fullWidth variant="secondary">
            Revenir à la connexion
          </Button>
        </div>
      </AuthLayout>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const result = validateEmailAddress({ email })
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    setSubmitting(true)
    try {
      await requestPasswordReset(result.values.email)
      setSent(true)
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indiquez l’adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe."
      footer={footer}
    >
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <Field label="Adresse e-mail" htmlFor="oubli-email" required error={errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="prenom.nom@exemple.sn"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth loading={submitting}>
          Recevoir le lien
        </Button>
      </form>
    </AuthLayout>
  )
}
