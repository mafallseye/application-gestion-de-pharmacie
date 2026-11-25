import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Banknote, Smartphone, Trash2 } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageLoader,
  Stack,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { errorMessage } from '../../lib/errors.js'
import { formatDateTime, formatMoney, formatNumber } from '../../lib/format.js'
import { validatePayment } from '../../lib/validation.js'
import { FormModal } from '../shared/FormModal.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { useDeleteSale, useRecordPayment, useSale } from './api.js'
import { customerLabel, saleBalance } from './filters.js'
import { useStartMobilePayment } from './mobileApi.js'
import { paymentMethodLabel, pendingMobilePayment } from './mobilePayment.js'
import { MobilePaymentPanel } from './MobilePaymentPanel.jsx'
import { PaymentBadge } from './PaymentBadge.jsx'
import styles from './SaleDetailPage.module.css'

const money = (value) => <span className={shared.nowrap}>{formatMoney(value)}</span>

const ITEM_COLUMNS = [
  { key: 'medicine_name', header: 'Médicament', render: (item) => <strong>{item.medicine_name}</strong> },
  { key: 'unit_price', header: 'Prix unitaire', align: 'right', render: (item) => money(item.unit_price) },
  { key: 'quantity', header: 'Quantité', align: 'right', render: (item) => formatNumber(item.quantity) },
  { key: 'line_total', header: 'Total', align: 'right', render: (item) => money(item.line_total) },
]

const PAYMENT_COLUMNS = [
  { key: 'created_at', header: 'Date', render: (payment) => <span className={shared.nowrap}>{formatDateTime(payment.created_at)}</span> },
  { key: 'method', header: 'Mode', render: (payment) => paymentMethodLabel(payment.method) },
  { key: 'author', header: 'Encaissé par', render: (payment) => payment.author?.full_name || payment.author?.email || '—' },
  { key: 'amount', header: 'Montant', align: 'right', render: (payment) => money(payment.amount) },
]

const backButton = (
  <Button as={Link} to="/ventes" variant="secondary" icon={ArrowLeft}>
    Retour aux ventes
  </Button>
)

export default function SaleDetailPage() {
  const { id } = useParams()
  const saleId = /^\d+$/.test(id) ? Number(id) : null

  const navigate = useNavigate()
  const toast = useToast()
  const { isAdmin, canWrite, canSell, pharmacy } = useAuth()

  // Pendant l'annulation, la requête est suspendue : elle ne doit pas
  // recharger une vente qui vient d'être supprimée.
  const [cancelling, setCancelling] = useState(false)
  const sale = useSale(saleId, { enabled: !cancelling })
  // On affiche le numéro de la vente dans la pharmacie ; l'identifiant de l'URL reste technique.
  const number = sale.data?.number
  usePageTitle(number ? `Vente n° ${number}` : 'Vente')
  const recordPayment = useRecordPayment()
  const deleteSale = useDeleteSale()
  const [paying, setPaying] = useState(false)
  const startMobile = useStartMobilePayment()
  const [payingMobile, setPayingMobile] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (saleId === null) {
    return (
      <>
        <PageHeader title="Vente introuvable" actions={backButton} />
        <Alert tone="danger">Ce numéro de vente n’est pas valide.</Alert>
      </>
    )
  }
  if (sale.isPending) return <PageLoader fullScreen={false} label="Chargement de la vente…" />
  if (sale.isError && !sale.data) {
    return (
      <>
        <PageHeader title="Vente" actions={backButton} />
        <Alert
          tone="danger"
          title="Chargement impossible"
          action={
            <Button size="sm" variant="secondary" loading={sale.isFetching} onClick={() => sale.refetch()}>
              Réessayer
            </Button>
          }
        >
          {errorMessage(sale.error)}
        </Alert>
      </>
    )
  }

  const data = sale.data
  const balance = saleBalance(data)
  const mobileEnabled = canSell && pharmacy.mobile_money_enabled === true
  // Demande de paiement mobile en cours (une seule par vente). Sans lien de
  // paiement, elle n'a pas abouti chez le prestataire : on propose de la relancer.
  const pendingMobile = pendingMobilePayment(data)
  const resumable = pendingMobile?.order_id && pendingMobile.checkout_url
  const mobileStuck = (data.awaiting_mobile || pendingMobile) && !resumable

  const onMobileFinal = (phase) => {
    if (phase === 'sale_cancelled') {
      // La vente n'existe plus : on ne la recharge pas, on revient à la liste.
      setCancelling(true)
      navigate('/ventes', { replace: true })
      toast.success(`Vente n° ${number} annulée : le stock a été rendu.`)
    } else if (phase === 'completed') {
      toast.success('Paiement mobile reçu.')
    }
  }

  const restartMobile = async () => {
    try {
      await startMobile.mutateAsync({ saleId })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const cancelSale = async () => {
    setCancelling(true)
    try {
      await deleteSale.mutateAsync(saleId)
      navigate('/ventes', { replace: true })
      toast.success(`Vente n° ${number} annulée : le stock a été remis à jour.`)
    } catch (error) {
      setCancelling(false)
      setConfirmingCancel(false)
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={`Vente n° ${data.number}`}
        subtitle={`Enregistrée le ${formatDateTime(data.sold_at)}`}
        actions={
          <>
            {backButton}
            {isAdmin && canWrite ? (
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmingCancel(true)}>
                Annuler la vente
              </Button>
            ) : null}
            {balance > 0 && mobileEnabled && !pendingMobile && !data.awaiting_mobile ? (
              <Button variant="secondary" icon={Smartphone} onClick={() => setPayingMobile(true)}>
                Encaisser par mobile money
              </Button>
            ) : null}
            {balance > 0 && canSell ? (
              <Button
                icon={Banknote}
                onClick={() => setPaying(true)}
                // Deux encaissements en même temps pourraient dépasser le reste à payer.
                disabled={Boolean(pendingMobile)}
                title={pendingMobile ? 'Annulez d’abord la demande de paiement mobile en attente.' : undefined}
              >
                Encaisser
              </Button>
            ) : null}
          </>
        }
      />

      <Stack gap="var(--space-4)">
        <Card>
          <dl className={styles.summary}>
            <div>
              <dt>Client</dt>
              <dd>{customerLabel(data)}</dd>
            </div>
            <div>
              <dt>Vendeur</dt>
              <dd>{data.seller?.full_name || data.seller?.email || '—'}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd data-numeric>{formatMoney(data.grand_total)}</dd>
            </div>
            <div>
              <dt>Payé</dt>
              <dd data-numeric>{formatMoney(data.paid_amount)}</dd>
            </div>
            <div>
              <dt>Reste à payer</dt>
              <dd data-numeric>{formatMoney(balance)}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>
                <PaymentBadge sale={data} />
              </dd>
            </div>
          </dl>
        </Card>

        {resumable && canSell ? (
          <Card title="Paiement mobile en attente" subtitle="Présentez ce code au client, ou annulez la demande pour encaisser en espèces.">
            <div className={styles.mobilePanel}>
              <MobilePaymentPanel
                key={pendingMobile.id}
                payment={{ payment_id: pendingMobile.id, order_id: pendingMobile.order_id, url: pendingMobile.checkout_url, amount: pendingMobile.amount }}
                saleNumber={data.number}
                wholeSale={data.awaiting_mobile && Number(data.paid_amount) === 0}
                onFinal={onMobileFinal}
              />
            </div>
            {data.awaiting_mobile && Number(data.paid_amount) === 0 ? (
              <p className={shared.note}>
                Le client préfère payer en espèces ? Annulez cette vente (le stock est rendu), puis refaites-la à la caisse en espèces.
              </p>
            ) : (
              <p className={shared.note}>L’encaissement en espèces est suspendu tant que cette demande est en attente.</p>
            )}
          </Card>
        ) : null}
        {mobileStuck && canSell ? (
          <Alert
            tone="warning"
            title="Paiement mobile à relancer"
            action={
              mobileEnabled ? (
                <Button size="sm" variant="secondary" loading={startMobile.isPending} onClick={restartMobile}>
                  Relancer le paiement
                </Button>
              ) : null
            }
          >
            Cette vente attend un paiement par mobile money, mais la demande n’a pas abouti. Relancez-la
            {isAdmin ? ', ou annulez la vente.' : ', ou demandez à l’administrateur d’annuler la vente.'}
          </Alert>
        ) : null}

        <section>
          <h2 className={styles.sectionTitle}>Articles</h2>
          <DataTable caption="Articles de la vente" columns={ITEM_COLUMNS} rows={data.items} rowKey={(item) => item.id} mobileCards minWidth="32rem" />
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Paiements</h2>
          <DataTable
            caption="Historique des paiements"
            columns={PAYMENT_COLUMNS}
            rows={data.payments}
            rowKey={(payment) => payment.id}
            mobileCards
            minWidth="28rem"
            empty={<EmptyState compact title="Aucun paiement" message="Rien n’a encore été encaissé pour cette vente." />}
          />
        </section>
      </Stack>

      <FormModal
        open={paying}
        onClose={() => setPaying(false)}
        title="Encaisser un paiement"
        description={`Reste à payer : ${formatMoney(balance)}`}
        size="sm"
        submitLabel="Encaisser"
        successMessage="Paiement encaissé."
        initialValues={{ amount: String(balance) }}
        validate={(values) => validatePayment(values, { max: balance })}
        onSubmit={({ amount }) => recordPayment.mutateAsync({ saleId, amount })}
      >
        {({ errors, bind }) => (
          <Field label="Montant encaissé" htmlFor="encaissement-montant" required error={errors.amount}>
            <Input {...bind('amount')} inputMode="numeric" suffix="FCFA" autoComplete="off" />
          </Field>
        )}
      </FormModal>

      <FormModal
        open={payingMobile}
        onClose={() => setPayingMobile(false)}
        title="Encaisser par mobile money"
        description={`Reste à payer : ${formatMoney(balance)}. Un code QR à présenter au client s’affichera ensuite.`}
        size="sm"
        submitLabel="Demander le paiement"
        successMessage="Demande de paiement mobile créée."
        initialValues={{ amount: String(balance) }}
        validate={(values) => validatePayment(values, { max: balance })}
        onSubmit={({ amount }) => startMobile.mutateAsync({ saleId, amount })}
      >
        {({ errors, bind }) => (
          <Field label="Montant à encaisser" htmlFor="encaissement-mobile-montant" required error={errors.amount}>
            <Input {...bind('amount')} inputMode="numeric" suffix="FCFA" autoComplete="off" />
          </Field>
        )}
      </FormModal>

      <ConfirmDialog
        open={confirmingCancel}
        title={`Annuler la vente n° ${data.number} ?`}
        message={
          <>
            La vente de <strong>{formatMoney(data.grand_total)}</strong> sera supprimée définitivement et les quantités vendues
            retourneront en stock. Cette action est irréversible.
          </>
        }
        confirmLabel="Annuler la vente"
        cancelLabel="Conserver la vente"
        loading={deleteSale.isPending}
        onConfirm={cancelSale}
        onCancel={() => setConfirmingCancel(false)}
      />
    </>
  )
}
