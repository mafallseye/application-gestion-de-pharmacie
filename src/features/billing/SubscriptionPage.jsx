import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  FormGrid,
  FullRow,
  Input,
  PageHeader,
  PageLoader,
  Stack,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { errorMessage } from '../../lib/errors.js'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format.js'
import { hasErrors, validatePharmacy } from '../../lib/validation.js'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { usePaymentCheck, usePlans, useSavePharmacy, useStartCheckout, useSubscriptionPayments } from './api.js'
import styles from './SubscriptionPage.module.css'

const STATUS = {
  trial: { tone: 'info', label: 'Période d’essai' },
  active: { tone: 'success', label: 'Abonnement en cours' },
  expired: { tone: 'danger', label: 'Expiré' },
}

const PAYMENT_STATUS = {
  completed: { tone: 'success', label: 'Payé' },
  pending: { tone: 'warning', label: 'En attente' },
  cancelled: { tone: 'neutral', label: 'Annulé' },
  failed: { tone: 'danger', label: 'Échoué' },
}

const duration = (months) => (months === 1 ? '1 mois' : months === 12 ? '1 an' : `${months} mois`)

export default function SubscriptionPage() {
  usePageTitle('Abonnement')
  const { subscription, pharmacy } = useAuth()
  const [params, setParams] = useSearchParams()
  const token = params.get('token')
  const cancelled = params.get('annule') === '1'

  return (
    <>
      <PageHeader title="Abonnement" subtitle={`Accès de ${pharmacy.name} à l’application et fiche de la pharmacie.`} />
      <Stack gap="var(--space-4)">
        {token ? <PaymentResult token={token} onDismiss={() => setParams({}, { replace: true })} /> : null}
        {cancelled && !token ? (
          <Alert tone="info" title="Paiement annulé">
            Aucun montant n’a été débité. Vous pouvez relancer le paiement quand vous le souhaitez.
          </Alert>
        ) : null}
        <StatusCard subscription={subscription} />
        <Plans subscription={subscription} />
        <PaymentHistory />
        <PharmacyForm pharmacy={pharmacy} />
      </Stack>
    </>
  )
}

/** Résultat du paiement au retour de PayDunya (?token=…). */
function PaymentResult({ token, onDismiss }) {
  const check = usePaymentCheck(token)
  const again = (
    <Button size="sm" variant="secondary" loading={check.isFetching} onClick={() => check.refetch()}>
      Vérifier à nouveau
    </Button>
  )
  const close = (
    <Button size="sm" variant="secondary" onClick={onDismiss}>
      Fermer
    </Button>
  )

  if (check.isPending) return <Alert tone="info">Vérification du paiement en cours…</Alert>
  if (check.isError) {
    return (
      <Alert tone="danger" title="Le paiement n’a pas pu être vérifié" action={again}>
        {errorMessage(check.error)}
      </Alert>
    )
  }
  switch (check.data) {
    case 'completed':
      return (
        <Alert tone="success" title="Paiement reçu, merci !" action={close}>
          Votre abonnement a été prolongé.
        </Alert>
      )
    case 'pending':
      return (
        <Alert tone="warning" title="Paiement en attente de confirmation" action={again}>
          La confirmation peut prendre quelques minutes. Votre abonnement sera prolongé dès qu’elle arrivera.
        </Alert>
      )
    case 'cancelled':
      return (
        <Alert tone="info" title="Paiement annulé" action={close}>
          Aucun montant n’a été débité.
        </Alert>
      )
    case 'failed':
      return (
        <Alert tone="danger" title="Le paiement a échoué" action={close}>
          Aucun abonnement n’a été enregistré. Vous pouvez réessayer ci-dessous.
        </Alert>
      )
    default:
      return (
        <Alert tone="danger" title="Paiement introuvable" action={close}>
          Cette référence de paiement ne correspond à aucun paiement de votre pharmacie.
        </Alert>
      )
  }
}

function StatusCard({ subscription }) {
  const status = STATUS[subscription.status]
  let detail = 'L’application est en lecture seule : les ventes et les modifications sont bloquées.'
  if (subscription.canWrite) {
    const days = subscription.daysLeft > 1 ? `${subscription.daysLeft} jours restants` : 'moins de 24 heures restantes'
    detail = `${subscription.status === 'trial' ? 'Essai gratuit' : 'Abonnement'} jusqu’au ${formatDate(subscription.endsAt)} (${days}).`
  } else if (subscription.endsAt) {
    detail = `Accès terminé le ${formatDate(subscription.endsAt)}. ${detail}`
  }
  return (
    <Card title="État de l’abonnement" actions={<Badge tone={status.tone}>{status.label}</Badge>}>
      <p>{detail}</p>
      {subscription.canWrite ? (
        <p className={shared.note}>Un abonnement payé maintenant s’ajoute à la fin de la période en cours : vous ne perdez aucun jour.</p>
      ) : null}
    </Card>
  )
}

function Plans({ subscription }) {
  const plans = usePlans()
  const checkout = useStartCheckout()
  // Offre en cours de paiement : le bouton reste « en chargement » jusqu'à la redirection.
  const [starting, setStarting] = useState(null)
  const [error, setError] = useState(null)

  const subscribe = async (plan) => {
    if (starting) return
    setStarting(plan.code)
    setError(null)
    try {
      const { url } = await checkout.mutateAsync(plan.code)
      // Navigation simple vers la page de paiement PayDunya (ni formulaire ni fetch : la CSP du site les limite).
      window.location.assign(url)
    } catch (checkoutError) {
      setError(errorMessage(checkoutError))
      setStarting(null)
    }
  }

  return (
    <Card title="Offres" subtitle="Paiement sécurisé par PayDunya (Orange Money, Wave, carte bancaire…).">
      {error ? (
        <Alert tone="danger" title="Paiement impossible" className={shared.pageAlert}>
          {error}
        </Alert>
      ) : null}
      {plans.isPending ? (
        <PageLoader fullScreen={false} label="Chargement des offres…" />
      ) : plans.isError ? (
        <LoadError query={plans} />
      ) : (
        <ul className={styles.plans}>
          {plans.data.map((plan) => (
            <li key={plan.code} className={styles.plan}>
              <h3 className={styles.planName}>{plan.label}</h3>
              <p className={styles.planPrice} data-numeric>
                {formatMoney(plan.amount)}
              </p>
              <p className={styles.planDuration}>pour {duration(plan.months)}</p>
              <Button
                fullWidth
                icon={CreditCard}
                loading={starting === plan.code}
                disabled={starting !== null && starting !== plan.code}
                onClick={() => subscribe(plan)}
              >
                {subscription.status === 'trial' ? 'S’abonner' : 'Renouveler'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const PAYMENT_COLUMNS = [
  { key: 'created_at', header: 'Date', render: (payment) => <span className={shared.nowrap}>{formatDateTime(payment.created_at)}</span> },
  { key: 'plan', header: 'Offre', render: (payment) => `${payment.plan} (${duration(payment.months)})` },
  { key: 'amount', header: 'Montant', align: 'right', render: (payment) => <span className={shared.nowrap}>{formatMoney(payment.amount)}</span> },
  {
    key: 'status',
    header: 'Statut',
    render: (payment) => {
      const status = PAYMENT_STATUS[payment.status] ?? { tone: 'neutral', label: payment.status }
      return <Badge tone={status.tone}>{status.label}</Badge>
    },
  },
]

function PaymentHistory() {
  const payments = useSubscriptionPayments()
  return (
    <section>
      <h2 className={styles.sectionTitle}>Historique des paiements</h2>
      {payments.isError ? (
        <LoadError query={payments} />
      ) : (
        <DataTable
          caption="Historique des paiements d’abonnement"
          columns={PAYMENT_COLUMNS}
          rows={payments.data}
          rowKey={(payment) => payment.id}
          loading={payments.isPending}
          skeletonRows={2}
          mobileCards
          minWidth="30rem"
          empty={<EmptyState compact icon={CreditCard} title="Aucun paiement" message="Vos paiements d’abonnement apparaîtront ici." />}
        />
      )}
    </section>
  )
}

function PharmacyForm({ pharmacy }) {
  const toast = useToast()
  const save = useSavePharmacy()
  const formRef = useRef(null)
  const [form, setForm] = useState({ name: pharmacy.name, phone: pharmacy.phone, address: pharmacy.address })
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)

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
    if (save.isPending) return
    const result = validatePharmacy(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    try {
      await save.mutateAsync({ id: pharmacy.id, ...result.values })
      toast.success('Fiche de la pharmacie enregistrée.')
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <Card title="Ma pharmacie" subtitle="Ces informations identifient votre officine dans l’application.">
      <form ref={formRef} onSubmit={submit} noValidate className={styles.form}>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <FormGrid>
          <Field label="Nom de la pharmacie" htmlFor="pharmacie-nom" required error={errors.name}>
            <Input {...bind('name')} maxLength={160} />
          </Field>
          <Field label="Téléphone" htmlFor="pharmacie-telephone" error={errors.phone}>
            <Input {...bind('phone')} type="tel" autoComplete="off" maxLength={40} />
          </Field>
          <FullRow>
            <Field label="Adresse" htmlFor="pharmacie-adresse" error={errors.address}>
              <Input {...bind('address')} maxLength={255} />
            </Field>
          </FullRow>
        </FormGrid>
        <div>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  )
}
