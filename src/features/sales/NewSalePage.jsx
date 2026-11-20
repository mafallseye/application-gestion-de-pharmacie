import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, PackageSearch, Plus, Receipt, ShoppingCart, Trash2 } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  useToast,
} from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'
import { formatMoney, formatNumber } from '../../lib/format.js'
import { validatePayment } from '../../lib/validation.js'
import { useCustomers } from '../customers/api.js'
import { useMedicines } from '../medicines/api.js'
import { filterMedicines } from '../medicines/filters.js'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { useCreateSale } from './api.js'
import { addToCart, balanceDue, cartCount, cartTotal, lineTotal, removeFromCart, setQuantity, syncCart, toSaleItems } from './cart.js'
import styles from './NewSalePage.module.css'

const CATALOGUE_SIZE = 30

export default function NewSalePage() {
  usePageTitle('Nouvelle vente')
  const toast = useToast()
  const medicines = useMedicines()
  const customers = useCustomers()
  const createSale = useCreateSale()

  const [search, setSearch] = useState('')
  const [savedCart, setSavedCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  // null : le montant payé suit le total ; sinon, le texte saisi par le vendeur.
  const [paidInput, setPaidInput] = useState(null)
  const [customerError, setCustomerError] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [lastSale, setLastSale] = useState(null)

  // Le panier affiché est toujours réaligné sur le stock et les prix à jour :
  // après un refus du serveur (stock insuffisant), il se corrige de lui-même.
  const cart = useMemo(() => syncCart(savedCart, medicines.data ?? []), [savedCart, medicines.data])
  const sellable = useMemo(() => filterMedicines(medicines.data, { search, status: 'sellable' }), [medicines.data, search])
  const catalogue = sellable.slice(0, CATALOGUE_SIZE)

  const total = cartTotal(cart)
  const payment = validatePayment({ amount: paidInput ?? String(total) }, { allowZero: true })
  const given = payment.values.amount ?? 0
  const paymentError = payment.errors.amount
  const due = balanceDue(total, given)

  const updateCart = (next) => {
    setSavedCart(next)
    setServerError(null)
    setLastSale(null)
  }
  const quantityInCart = (medicineId) => cart.find((line) => line.medicine_id === medicineId)?.quantity ?? 0

  let paymentHint = null
  if (cart.length > 0 && !paymentError) {
    if (due > 0) paymentHint = `Reste dû : ${formatMoney(due)} (vente à crédit)`
    else if (given > total) paymentHint = `Monnaie à rendre : ${formatMoney(given - total)}`
    else paymentHint = 'Paiement complet.'
  }

  const submit = async (event) => {
    event.preventDefault()
    if (cart.length === 0 || paymentError || createSale.isPending) return
    if (due > 0 && !customerId) {
      setCustomerError('Choisissez un client : une vente à crédit doit être rattachée à un client.')
      return
    }
    setServerError(null)
    try {
      const saleId = await createSale.mutateAsync({
        customerId: customerId ? Number(customerId) : null,
        // On n'enregistre jamais plus que le total : le surplus est la monnaie rendue.
        paidAmount: Math.min(given, total),
        items: toSaleItems(cart),
      })
      setLastSale({ id: saleId, change: Math.max(0, given - total) })
      setSavedCart([])
      setCustomerId('')
      setPaidInput(null)
      setSearch('')
      toast.success(`Vente n° ${saleId} enregistrée.`)
    } catch (error) {
      // Le stock est rechargé par useCreateSale : le panier se resynchronise.
      setServerError(errorMessage(error))
    }
  }

  if (medicines.isPending) return <PageLoader fullScreen={false} label="Chargement du catalogue…" />

  return (
    <>
      <PageHeader title="Nouvelle vente" subtitle="Ajoutez les médicaments au panier, puis encaissez." />

      {medicines.isError ? <LoadError query={medicines} /> : null}

      {lastSale ? (
        <Alert
          tone="success"
          title={`Vente n° ${lastSale.id} enregistrée`}
          className={shared.pageAlert}
          action={
            <Button as={Link} to={`/ventes/${lastSale.id}`} variant="secondary" size="sm">
              Voir la vente
            </Button>
          }
        >
          {lastSale.change > 0 ? `Monnaie à rendre : ${formatMoney(lastSale.change)}` : 'Le stock a été mis à jour.'}
        </Alert>
      ) : null}

      <div className={styles.pos}>
        <Card title="Médicaments" subtitle="Seuls les médicaments en stock et non périmés peuvent être vendus.">
          <SearchInput value={search} onChange={setSearch} placeholder="Nom du médicament…" />
          {catalogue.length === 0 ? (
            <EmptyState
              compact
              icon={PackageSearch}
              title="Aucun médicament à vendre"
              message={search.trim() ? 'Aucun médicament vendable ne correspond à cette recherche.' : 'Aucun médicament en stock.'}
            />
          ) : (
            <ul className={styles.catalogue}>
              {catalogue.map((medicine) => (
                <li key={medicine.id} className={styles.catalogueItem}>
                  <div className={shared.stacked}>
                    <span className={shared.primary}>{medicine.brand_name}</span>
                    <span className={shared.secondary}>
                      {medicine.generic_name ? `${medicine.generic_name} · ` : ''}
                      {formatNumber(medicine.quantity)} en stock
                    </span>
                  </div>
                  <span className={styles.cataloguePrice} data-numeric>
                    {formatMoney(medicine.price)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    disabled={quantityInCart(medicine.id) >= medicine.quantity}
                    aria-label={`Ajouter ${medicine.brand_name} au panier`}
                    onClick={() => updateCart(addToCart(cart, medicine))}
                  >
                    Ajouter
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {sellable.length > CATALOGUE_SIZE ? (
            <p className={shared.note}>
              {CATALOGUE_SIZE} médicaments affichés sur {sellable.length} : précisez la recherche pour trouver les autres.
            </p>
          ) : null}
        </Card>

        <Card title="Panier" actions={<Badge tone="info">{cartCount(cart)} article{cartCount(cart) > 1 ? 's' : ''}</Badge>}>
          <form onSubmit={submit} noValidate>
            {cart.length === 0 ? (
              <EmptyState compact icon={ShoppingCart} title="Le panier est vide" message="Ajoutez un médicament depuis la liste." />
            ) : (
              <ul className={styles.cart}>
                {cart.map((line) => (
                  <li key={line.medicine_id} className={styles.cartLine}>
                    <div className={shared.stacked}>
                      <span className={shared.primary}>{line.name}</span>
                      <span className={shared.secondary} data-numeric>
                        {formatMoney(line.unit_price)} l’unité
                      </span>
                    </div>
                    <div className={styles.lineControls}>
                      <div className={styles.stepper}>
                        <IconButton
                          icon={Minus}
                          label={`Retirer un ${line.name}`}
                          disabled={line.quantity <= 1}
                          onClick={() => updateCart(setQuantity(cart, line.medicine_id, line.quantity - 1))}
                        />
                        <span className={styles.qty} data-numeric aria-label={`Quantité : ${line.quantity}`}>
                          {line.quantity}
                        </span>
                        <IconButton
                          icon={Plus}
                          label={`Ajouter un ${line.name}`}
                          disabled={line.quantity >= line.stock}
                          onClick={() => updateCart(setQuantity(cart, line.medicine_id, line.quantity + 1))}
                        />
                      </div>
                      <IconButton
                        icon={Trash2}
                        variant="danger"
                        label={`Retirer ${line.name} du panier`}
                        onClick={() => updateCart(removeFromCart(cart, line.medicine_id))}
                      />
                    </div>
                    <span className={styles.lineTotal} data-numeric>
                      {formatMoney(lineTotal(line))}
                    </span>
                    {line.quantity >= line.stock ? <span className={styles.stockNote}>Tout le stock disponible</span> : null}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.totalRow}>
              <span>Total à payer</span>
              <strong data-numeric>{formatMoney(total)}</strong>
            </div>

            <div className={styles.fields}>
              <Field label="Client" htmlFor="caisse-client" error={customerError} hint="Obligatoire pour une vente à crédit.">
                <Select
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value)
                    setCustomerError(null)
                  }}
                >
                  <option value="">Client de passage</option>
                  {(customers.data ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Montant payé" htmlFor="caisse-paye" error={paymentError} hint={paymentHint}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  suffix="FCFA"
                  value={paidInput ?? String(total)}
                  onChange={(event) => {
                    setPaidInput(event.target.value)
                    setCustomerError(null)
                  }}
                />
              </Field>
              {serverError ? (
                <Alert tone="danger" title="Vente non enregistrée">
                  {serverError} Le stock a été actualisé : vérifiez le panier avant de réessayer.
                </Alert>
              ) : null}
              <Button type="submit" fullWidth icon={Receipt} disabled={cart.length === 0} loading={createSale.isPending}>
                Enregistrer la vente
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
