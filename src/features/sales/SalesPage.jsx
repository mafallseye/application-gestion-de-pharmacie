import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Receipt, ShoppingCart } from 'lucide-react'
import { Button, DataTable, EmptyState, Input, PageHeader, SearchInput, Toolbar } from '../../components/ui'
import { formatDateTime, formatMoney } from '../../lib/format.js'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { useSales } from './api.js'
import { customerLabel, filterSales, saleBalance } from './filters.js'
import { PaymentBadge } from './PaymentBadge.jsx'

const LIMIT = 500
const money = (value) => <span className={shared.nowrap}>{formatMoney(value)}</span>

const COLUMNS = [
  { key: 'id', header: 'N°', width: '5rem', render: (sale) => <strong>{sale.id}</strong> },
  { key: 'sold_at', header: 'Date', render: (sale) => <span className={shared.nowrap}>{formatDateTime(sale.sold_at)}</span> },
  { key: 'customer', header: 'Client', render: customerLabel },
  { key: 'grand_total', header: 'Total', align: 'right', render: (sale) => money(sale.grand_total) },
  { key: 'paid_amount', header: 'Payé', align: 'right', render: (sale) => money(sale.paid_amount) },
  { key: 'balance', header: 'Reste', align: 'right', render: (sale) => money(saleBalance(sale)) },
  { key: 'status', header: 'Statut', render: (sale) => <PaymentBadge sale={sale} /> },
]

export default function SalesPage() {
  usePageTitle('Ventes')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const unpaidOnly = params.get('impayees') === '1'
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // La période est filtrée côté serveur (l'historique peut dépasser la limite chargée).
  const sales = useSales({ from, to, limit: LIMIT })
  const rows = useMemo(() => filterSales(sales.data, { search, unpaidOnly }), [sales.data, search, unpaidOnly])
  const filtering = search.trim() !== '' || unpaidOnly || from !== '' || to !== ''

  const setUnpaidOnly = (checked) => setParams(checked ? { impayees: '1' } : {}, { replace: true })
  const clearFilters = () => {
    setSearch('')
    setFrom('')
    setTo('')
    setParams({}, { replace: true })
  }

  const newSaleButton = (
    <Button as={Link} to="/caisse" icon={ShoppingCart}>
      Nouvelle vente
    </Button>
  )

  return (
    <>
      <PageHeader title="Ventes" subtitle="Historique des ventes et encaissements." actions={newSaleButton} />

      {sales.isError ? (
        <LoadError query={sales} />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Client, vendeur ou n° de vente…" />
            <div className={shared.filters}>
              <label className={shared.inlineField}>
                Du
                <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className={shared.inlineField}>
                au
                <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
              </label>
              <label className={shared.checkbox}>
                <input type="checkbox" checked={unpaidOnly} onChange={(event) => setUnpaidOnly(event.target.checked)} />
                Impayées seulement
              </label>
            </div>
          </Toolbar>
          <DataTable
            caption="Liste des ventes"
            columns={COLUMNS}
            rows={rows}
            rowKey={(sale) => sale.id}
            loading={sales.isPending}
            onRowClick={(sale) => navigate(`/ventes/${sale.id}`)}
            mobileCards
            minWidth="48rem"
            empty={
              filtering ? (
                <EmptyState
                  compact
                  icon={Receipt}
                  title="Aucune vente trouvée"
                  message="Aucune vente ne correspond à ces filtres."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Effacer les filtres
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={Receipt}
                  title="Aucune vente"
                  message="Les ventes enregistrées à la caisse apparaîtront ici."
                  action={newSaleButton}
                />
              )
            }
          />
          {sales.data?.length === LIMIT ? (
            <p className={shared.note}>
              Seules les {LIMIT} ventes les plus récentes sont affichées. Indiquez une période pour consulter les plus anciennes.
            </p>
          ) : null}
        </>
      )}
    </>
  )
}
