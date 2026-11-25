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
import { MobileMoneySettings } from './MobileMoneySettings.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { usePaymentCheck, usePlans, useSavePharmacy, useStartCheckout, useSubscriptionPayments, useVerifyPayment } from './api.js'
import { canVerify, paymentBadge, paymentOutcome, paymentsToRecheck } from './payments.js'
import styles from './SubscriptionPage.module.css'

const STATUS = {
  trial: { tone: 'info', label: 'Période d’essai' },
  active: { tone: 'success', label: 'Abonnement en cours' },
  expired: { tone: 'danger', label: 'Expiré' },
}

// Référence du paiement en cours, gardée le temps de l'aller-retour vers la page
// de paiement : certains prestataires ne la renvoient pas dans l'adresse de retour.
const PENDING_KEY = 'pharmacie-paiement-en-cours'
function rememberPayment(token) {
  try {
    if (token) sessionStorage.setItem(PENDING_KEY, token)
    else sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // stockage indisponible : la vérification d'office de l'historique prend le relais
  }
}
function rememberedPayment() {
  try {
    return sessionStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

const duration = (months) => (months === 1 ? '1 mois' : months === 12 ? '1 an' : `${months} mois`)

export default function SubscriptionPage() {
  usePageTitle('Abonnement')
  const { subscription, pharmacy } = useAuth()
  const [params, setParams] = useSearchParams()
  const token = params.get('token') ?? (params.get('retour') === '1' ? rememberedPayment() : null)
  const cancelled = params.get('annule') === '1'

  return (
    <>
      <PageHeader title="Abonnement" subtitle={`Accès de ${pharmacy.name} à l’application et fiche de la pharmacie.`} />
      <Stack gap="var(--space-4)">
        {token ? <PaymentResult token={token} onDismiss={() => {
              rememberPayment(null)
              setParams({}, { replace: true })
            }}
          /> : null}
        {cancelled && !token ? (
          <Alert tone="info" title="Paiement annulé">
            Aucun montant n’a été débité. Vous pouvez relancer le paiement quand vous le souhaitez.
          </Alert>
        ) : null}
        <StatusCard subscription={subscription} />
        <Plans subscription={subscription} />
        <PaymentHistory skipToken={token} />
        <PharmacyForm pharmacy={pharmacy} />
        <MobileMoneySettings />
      </Stack>
    </>
  )
}

/** Résultat d'une vérification : `status` de la fonction billing, ou `error` (appel refusé). */
function Outcome({ status, error, checking, onRetry, onClose }) {
  // Appel refusé (429, 502, 503…) : le message du serveur est affiché tel quel.
  const outcome = error
    ? { tone: 'danger', title: 'Le paiement n’a pas pu être vérifié', message: errorMessage(error), retry: true }
    : paymentOutcome(status)
  return (
    <Alert
      tone={outcome.tone}
      title={outcome.title}
      action={
        outcome.retry ? (
          <Button size="sm" variant="secondary" loading={checking} onClick={onRetry}>
            {error || status === 'error' ? 'Réessayer' : 'Vérifier à nouveau'}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        )
      }
    >
      {outcome.message}
    </Alert>
  )
}

/** Résultat du paiement au retour du paiement (?token=…). */
function PaymentResult({ token, onDismiss }) {
  const check = usePaymentCheck(token)
  if (check.isPending) return <Alert tone="info">Vérification du paiement en cours…</Alert>
  return (
    <Outcome
      status={check.data}
      error={check.isError ? check.error : null}
      checking={check.isFetching}
      onRetry={() => check.refetch()}
      onClose={onDismiss}
    />
  )
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
      const { url, token } = await checkout.mutateAsync(plan.code)
      rememberPayment(token)
      // Navigation simple vers la page de paiement (ni formulaire ni fetch : la CSP du site les limite).
      window.location.assign(url)
    } catch (checkoutError) {
      setError(errorMessage(checkoutError))
      setStarting(null)
    }
  }

  return (
    <Card title="Offres" subtitle="Paiement sécurisé par mobile money (Wave, Orange Money).">
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
      const badge = paymentBadge(payment.status)
      return <Badge tone={badge.tone}>{badge.label}</Badge>
    },
  },
]

/**
 * Historique des paiements. Un paiement resté « en attente » (onglet fermé
 * avant le retour du paiement) peut être revérifié : d'office à l'ouverture de
 * la page pour les paiements récents, puis à la demande (bouton « Vérifier »).
 * `skipToken` : paiement déjà vérifié par le retour ?token=….
 */
function PaymentHistory({ skipToken }) {
  const toast = useToast()
  const payments = useSubscriptionPayments()
  const verify = useVerifyPayment()
  // Dernière vérification demandée : { id, status } ou { id, error }.
  const [checked, setChecked] = useState(null)
  const autoChecked = useRef(false)

  // Vérification d'office, une seule fois par ouverture de la page (pas de boucle).
  const verifyAsync = verify.mutateAsync
  useEffect(() => {
    if (autoChecked.current || !payments.data) return
    autoChecked.current = true
    const pending = paymentsToRecheck(payments.data).filter((payment) => payment.provider_token !== skipToken)
    const run = async () => {
      for (const payment of pending) {
        // Silencieux en cas d'échec : le bouton « Vérifier » reste disponible sur la ligne.
        const status = await verifyAsync(payment.provider_token).catch(() => null)
        if (status === 'completed') toast.success('Un paiement en attente a été validé : votre abonnement est prolongé.')
      }
    }
    run()
  }, [payments.data, skipToken, verifyAsync, toast])

  const check = async (payment) => {
    setChecked(null)
    try {
      setChecked({ id: payment.id, token: payment.provider_token, status: await verify.mutateAsync(payment.provider_token) })
    } catch (error) {
      setChecked({ id: payment.id, token: payment.provider_token, error })
    }
  }

  const columns = [
    ...PAYMENT_COLUMNS,
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '7rem',
      render: (payment) =>
        canVerify(payment) ? (
          <Button
            size="sm"
            variant="secondary"
            loading={verify.isPending && verify.variables === payment.provider_token}
            disabled={verify.isPending}
            onClick={() => check(payment)}
          >
            Vérifier
          </Button>
        ) : null,
    },
  ]

  return (
    <section>
      <h2 className={styles.sectionTitle}>Historique des paiements</h2>
      {checked ? (
        <div className={shared.pageAlert}>
          <Outcome
            status={checked.status}
            error={checked.error ?? null}
            checking={verify.isPending}
            onRetry={() => check({ id: checked.id, provider_token: checked.token })}
            onClose={() => setChecked(null)}
          />
        </div>
      ) : null}
      {payments.isError ? (
        <LoadError query={payments} />
      ) : (
        <DataTable
          caption="Historique des paiements d’abonnement"
          columns={columns}
          rows={payments.data}
          rowKey={(payment) => payment.id}
          loading={payments.isPending}
          skeletonRows={2}
          mobileCards
          minWidth="36rem"
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
