import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import { Alert } from '../components/ui'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import styles from './auth.module.css'

/** Affiché quand les variables d'environnement Supabase sont absentes ou invalides. */
export default function SetupPage() {
  usePageTitle('Configuration requise')
  return (
    <AuthLayout
      title="Configuration requise"
      subtitle="L’application ne sait pas encore à quel projet Supabase se connecter."
    >
      <Alert tone="warning" title="Fichier .env.local manquant ou incomplet">
        Copiez <code>.env.example</code> en <code>.env.local</code> à la racine du projet, renseignez les deux valeurs
        ci-dessous (Supabase : Project Settings, API), puis relancez l’application.
        <code className={styles.code}>
          VITE_SUPABASE_URL=https://votre-projet.supabase.co{'\n'}VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
        </code>
      </Alert>
    </AuthLayout>
  )
}
