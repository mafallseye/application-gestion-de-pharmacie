import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Banknote, Trash2 } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
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
import { PaymentBadge } from './PaymentBadge.jsx'
import styles from './SaleDetailPage.module.css'

const money = (value) => <span className={shared.nowrap}>{formatMoney(value)}</span>

const ITEM_COLUMNS = [
  { key: 'medicine_name', header: 'Médicament', render: (item) => <strong>{item.medicine_name}</strong> },
  { key: 'unit_price', header: 'Prix unitaire', align: 'right', render: (item) => money(item.unit_price) },
  { key: 'quantity', header: 'Quantité', align: 'right', render: (item) => formatNumber(item.quantity) },
  { key: 'line_total', header: 'Total', align: 'right', render: (item) => money(item.line_total) },
]

const backButton = (
  <Button as={Link} to="/ventes" variant="secondary" icon={ArrowLeft}>
    Retour aux ventes
  </Button>
)

export default function SaleDetailPage() {
  const { id } = useParams()
  const saleId = /^\d+$/.test(id) ? Number(id) : null
  usePageTitle(saleId ? `Vente n° ${saleId}` : 'Vente introuvable')
  const navigate = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()

  // Pendant l'annulation, la requête est suspendue : elle ne doit pas
  // recharger une vente qui vient d'être supprimée.
  const [cancelling, setCancelling] = useState(false)
  const sale = useSale(saleId, { enabled: !cancelling })
  const recordPayment = useRecordPayment()
  const deleteSale = useDeleteSale()
  const [paying, setPaying] = useState(false)
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
        <PageHeader title={`Vente n° ${saleId}`} actions={backButton} />
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

  const cancelSale = async () => {
    setCancelling(true)
    try {
      await deleteSale.mutateAsync(saleId)
      navigate('/ventes', { replace: true })
      toast.success(`Vente n° ${saleId} annulée : le stock a été remis à jour.`)
    } catch (error) {
      setCancelling(false)
      setConfirmingCancel(false)
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={`Vente n° ${data.id}`}
        subtitle={`Enregistrée le ${formatDateTime(data.sold_at)}`}
        actions={
          <>
            {backButton}
            {isAdmin ? (
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmingCancel(true)}>
                Annuler la vente
              </Button>
            ) : null}
            {balance > 0 ? (
              <Button icon={Banknote} onClick={() => setPaying(true)}>
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

        <Card title="Articles" padded={false}>
          <DataTable caption="Articles de la vente" columns={ITEM_COLUMNS} rows={data.items} rowKey={(item) => item.id} mobileCards minWidth="32rem" />
        </Card>
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

      <ConfirmDialog
        open={confirmingCancel}
        title={`Annuler la vente n° ${data.id} ?`}
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
