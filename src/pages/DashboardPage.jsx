import { Link } from 'react-router-dom'
import { Banknote, CalendarClock, ClipboardList, PackageSearch, ShoppingCart, TrendingUp, TriangleAlert, Wallet } from 'lucide-react'
import { Alert, BarChart, Button, Card, EmptyState, Grid, PageHeader, PageLoader, Stack, StatCard } from '../components/ui'
import { useDashboardStats } from '../features/dashboard/api.js'
import { useSales } from '../features/sales/api.js'
import { customerLabel } from '../features/sales/filters.js'
import { PaymentBadge } from '../features/sales/PaymentBadge.jsx'
import { LoadError } from '../features/shared/LoadError.jsx'
import { usePageTitle } from '../features/shared/usePageTitle.js'
import { useAuth } from '../lib/auth.jsx'
import { formatDateTime, formatMoney, formatNumber } from '../lib/format.js'
import styles from './DashboardPage.module.css'

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
const plural = (count, one, many) => (count > 1 ? many : one)

const newSaleButton = (
  <Button as={Link} to="/caisse" icon={ShoppingCart}>
    Nouvelle vente
  </Button>
)

export default function DashboardPage() {
  usePageTitle('Tableau de bord')
  const { profile } = useAuth()
  const stats = useDashboardStats()
  const recentSales = useSales({ limit: 5 })
  const firstName = profile.full_name.trim().split(/\s+/)[0]

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={firstName ? `Bonjour ${firstName}, voici l’activité de la pharmacie.` : 'Activité de la pharmacie.'}
        actions={newSaleButton}
      />

      {stats.isPending ? (
        <PageLoader fullScreen={false} label="Chargement des indicateurs…" />
      ) : stats.isError && !stats.data ? (
        <LoadError query={stats} />
      ) : (
        <Stats stats={stats.data} recentSales={recentSales} />
      )}
    </>
  )
}

function Stats({ stats, recentSales }) {
  const chart = stats.sales_by_day.map((day) => ({ label: weekday.format(new Date(day.day)), value: Number(day.total) }))

  return (
    <Stack gap="var(--space-4)">
      {stats.expired_count > 0 ? (
        <Alert
          tone="danger"
          title={`${formatNumber(stats.expired_count)} ${plural(stats.expired_count, 'médicament périmé', 'médicaments périmés')}`}
          action={
            <Button as={Link} to="/medicaments?etat=expired" variant="secondary" size="sm">
              Voir la liste
            </Button>
          }
        >
          Retirez-les du rayon : ils ne peuvent plus être vendus.
        </Alert>
      ) : null}
      {stats.low_stock_count > 0 ? (
        <Alert
          tone="warning"
          title={`${formatNumber(stats.low_stock_count)} ${plural(stats.low_stock_count, 'médicament en stock bas', 'médicaments en stock bas')}`}
          action={
            <Button as={Link} to="/medicaments?etat=low_stock" variant="secondary" size="sm">
              Voir la liste
            </Button>
          }
        >
          Pensez à passer commande auprès des fournisseurs.
        </Alert>
      ) : null}

      <Grid min="19rem">
        <StatCard label="Ventes du jour" value={formatMoney(stats.sales_today)} icon={Banknote} tone="success" />
        <StatCard label="Ventes du mois" value={formatMoney(stats.sales_month)} icon={TrendingUp} />
        <StatCard
          label="Valeur du stock"
          value={formatMoney(stats.stock_value)}
          hint={`${formatNumber(stats.medicines_count)} ${plural(stats.medicines_count, 'référence', 'références')}`}
          icon={PackageSearch}
        />
        <StatCard
          label="Stock bas"
          value={formatNumber(stats.low_stock_count)}
          hint={<Link to="/medicaments?etat=low_stock">Voir les médicaments concernés</Link>}
          icon={TriangleAlert}
          tone={stats.low_stock_count > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Périmés ou bientôt périmés"
          value={formatNumber(stats.expired_count + stats.expiring_count)}
          hint={
            <>
              <Link to="/medicaments?etat=expired">{formatNumber(stats.expired_count)} {plural(stats.expired_count, 'périmé', 'périmés')}</Link>,{' '}
              <Link to="/medicaments?etat=expiring">{formatNumber(stats.expiring_count)} sous 90 jours</Link>
            </>
          }
          icon={CalendarClock}
          tone={stats.expired_count > 0 ? 'danger' : stats.expiring_count > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Impayés"
          value={formatMoney(stats.unpaid_total)}
          hint={<Link to="/ventes?impayees=1">Voir les ventes à encaisser</Link>}
          icon={Wallet}
          tone="info"
        />
      </Grid>

      <div className={styles.split}>
        <Card title="Ventes des 7 derniers jours" subtitle="En FCFA">
          <BarChart data={chart} formatValue={(value) => compact.format(value)} highlight={chart.length - 1} label="Ventes des 7 derniers jours" />
        </Card>
        <Card
          title="Dernières ventes"
          padded={false}
          actions={
            <Button as={Link} to="/ventes" variant="ghost" size="sm">
              Tout voir
            </Button>
          }
        >
          <RecentSales query={recentSales} />
        </Card>
      </div>
    </Stack>
  )
}

function RecentSales({ query }) {
  if (query.isPending) return <PageLoader fullScreen={false} label="Chargement des ventes…" />
  if (query.isError && !query.data) {
    return (
      <div className={styles.cardBody}>
        <LoadError query={query} />
      </div>
    )
  }
  if (query.data.length === 0) {
    return (
      <EmptyState
        compact
        icon={ClipboardList}
        title="Aucune vente pour le moment"
        message="Les ventes enregistrées à la caisse apparaîtront ici."
        action={newSaleButton}
      />
    )
  }
  return (
    <ul className={styles.saleList}>
      {query.data.map((sale) => (
        <li key={sale.id}>
          <Link to={`/ventes/${sale.id}`} className={styles.saleItem}>
            <span className={styles.saleMain}>
              <span className={styles.saleCustomer}>{customerLabel(sale)}</span>
              <span className={styles.saleMeta}>
                N° {sale.number}, {formatDateTime(sale.sold_at)}
              </span>
            </span>
            <span className={styles.saleAmount}>
              <span data-numeric>{formatMoney(sale.grand_total)}</span>
              <PaymentBadge sale={sale} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
