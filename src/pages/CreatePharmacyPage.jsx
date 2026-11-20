import { useEffect, useRef, useState } from 'react'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Field, Input } from '../components/ui'
import { useRegisterPharmacy } from '../features/billing/api.js'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { hasErrors, validatePharmacyRegistration } from '../lib/validation.js'
import styles from './auth.module.css'

/**
 * Compte connecté sans pharmacie : il crée la sienne et en devient
 * l'administrateur. Le profil est ensuite rechargé et l'application s'ouvre.
 */
export default function CreatePharmacyPage() {
  usePageTitle('Créer votre pharmacie')
  const { user, profile, signOut } = useAuth()
  const register = useRegisterPharmacy()
  const formRef = useRef(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', full_name: profile.full_name ?? '' })
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)

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
    if (register.isPending) return
    const result = validatePharmacyRegistration(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    try {
      await register.mutateAsync(result.values)
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Créez votre pharmacie"
      subtitle="Dernière étape : vous en serez l’administrateur, avec 14 jours d’essai gratuit."
      footer={
        <>
          Connecté en tant que {user.email}.{' '}
          <button type="button" className={styles.linkButton} onClick={signOut}>
            Se déconnecter
          </button>
        </>
      }
    >
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <Field label="Nom de la pharmacie" htmlFor="creation-nom" required error={errors.name}>
          <Input {...bind('name')} placeholder="ex. Pharmacie du Plateau" maxLength={160} />
        </Field>
        <Field label="Téléphone" htmlFor="creation-telephone" error={errors.phone}>
          <Input {...bind('phone')} type="tel" autoComplete="tel" placeholder="ex. 33 821 00 00" maxLength={40} />
        </Field>
        <Field label="Adresse" htmlFor="creation-adresse" error={errors.address}>
          <Input {...bind('address')} autoComplete="street-address" placeholder="ex. Avenue Lamine Guèye, Dakar" maxLength={255} />
        </Field>
        <Field label="Votre nom complet" htmlFor="creation-nom-complet" required error={errors.full_name}>
          <Input {...bind('full_name')} autoComplete="name" maxLength={120} />
        </Field>
        <Button type="submit" fullWidth loading={register.isPending}>
          Créer ma pharmacie
        </Button>
      </form>
    </AuthLayout>
  )
}
