import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert, Button, useToast } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/errors.js'
import { queryKeys } from '../lib/queryKeys.js'
import styles from './auth.module.css'

/**
 * Écran d'un utilisateur connecté qui ne peut pas encore entrer : compte en
 * attente d'activation, ou profil impossible à charger (`error`).
 */
export default function AccountStatusPage({ error = null }) {
  usePageTitle(error ? 'Profil indisponible' : 'Compte en attente')
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [checking, setChecking] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const checkAgain = async () => {
    setChecking(true)
    await queryClient.refetchQueries({ queryKey: queryKeys.profile(user.id) })
    setChecking(false)
  }

  const leave = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (signOutError) {
      setSigningOut(false)
      toast.error(errorMessage(signOutError))
    }
  }

  return (
    <AuthLayout
      title={error ? 'Profil indisponible' : 'Compte en attente d’activation'}
      subtitle={
        error
          ? 'Votre session est ouverte, mais votre profil n’a pas pu être chargé.'
          : 'Votre compte existe, mais un administrateur doit encore l’activer et vous attribuer un rôle.'
      }
      footer={`Connecté en tant que ${user.email}`}
    >
      <div className={styles.form}>
        {error ? (
          <Alert tone="danger">{errorMessage(error)}</Alert>
        ) : (
          <Alert tone="info" title="Que faire maintenant ?">
            Prévenez l’administrateur de la pharmacie, puis revenez sur cette page une fois le compte activé.
          </Alert>
        )}
        <Button fullWidth loading={checking} onClick={checkAgain}>
          {error ? 'Réessayer' : 'Vérifier à nouveau'}
        </Button>
        <Button fullWidth variant="ghost" loading={signingOut} onClick={leave}>
          Se déconnecter
        </Button>
      </div>
    </AuthLayout>
  )
}
