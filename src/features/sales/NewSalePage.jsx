import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Minus, PackageSearch, Plus, Receipt, ShoppingCart, Smartphone, Trash2 } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { errorMessage } from '../../lib/errors.js'
import { formatMoney, formatNumber } from '../../lib/format.js'
import { validatePayment } from '../../lib/validation.js'
import { useCustomers } from '../customers/api.js'
import { useMedicines } from '../medicines/api.js'
import { filterMedicines } from '../medicines/filters.js'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { saleExists, useCreateSale } from './api.js'
import { addToCart, balanceDue, cartCount, cartTotal, lineTotal, removeFromCart, setQuantity, syncCart, toSaleItems } from './cart.js'
import { useStartMobilePayment } from './mobileApi.js'
import { isFinalPhase } from './mobilePayment.js'
import { MobilePaymentPanel } from './MobilePaymentPanel.jsx'
import styles from './NewSalePage.module.css'

const CATALOGUE_SIZE = 30
// La caisse reste ouverte longtemps : prix et stock sont rechargés régulièrement.
const CATALOGUE_REFRESH_MS = 45_000

/**
 * Quantité d'une ligne du panier, saisissable au clavier. Le texte en cours de
 * frappe est gardé à part : un champ vide ou « 0 » ne modifie pas le panier, et
 * la valeur réelle (bornée par le stock) revient à la sortie du champ.
 */
function QuantityInput({ line, onChange }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      className={styles.qty}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={`Quantité de ${line.name} (${line.stock} en stock)`}
      data-numeric
      value={draft ?? String(line.quantity)}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        const text = event.target.value.replace(/\D/g, '').slice(0, 6)
        setDraft(text)
        if (Number(text) >= 1) onChange(Number(text))
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        // Entrée valide la quantité sans envoyer la vente.
        if (event.key === 'Enter') {
          event.preventDefault()
          event.target.blur()
        }
      }}
    />
  )
}

export default function NewSalePage() {
  usePageTitle('Nouvelle vente')
  const toast = useToast()
  const { canSell, pharmacy } = useAuth()
  const medicines = useMedicines({ refetchInterval: CATALOGUE_REFRESH_MS })
  const customers = useCustomers()
  const createSale = useCreateSale()
  const startPayment = useStartMobilePayment()

  const [search, setSearch] = useState('')
  const [savedCart, setSavedCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  // null : le montant payé suit le total ; sinon, le texte saisi par le vendeur.
  const [paidInput, setPaidInput] = useState(null)
  const [customerError, setCustomerError] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [lastSale, setLastSale] = useState(null)
  // Mode de paiement : espèces par défaut ; le mobile money n'est proposé que si la pharmacie l'a activé.
  const [mode, setMode] = useState('cash')
  const mobileEnabled = canSell && pharmacy.mobile_money_enabled === true
  const mobile = mobileEnabled && mode === 'mobile'
  // Vente en attente de paiement mobile : { id, number, payment, cart } (le panier est gardé pour le rendre si la vente est annulée).
  const [mobileSale, setMobileSale] = useState(null)
  const [mobilePhase, setMobilePhase] = useState('waiting')
  const [notice, setNotice] = useState(null)

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
    setNotice(null)
  }
  const quantityInCart = (medicineId) => cart.find((line) => line.medicine_id === medicineId)?.quantity ?? 0

  let paymentHint = null
  if (cart.length > 0 && !paymentError) {
    if (due > 0) paymentHint = `Reste dû : ${formatMoney(due)} (vente à crédit)`
    else if (given > total) paymentHint = `Monnaie à rendre : ${formatMoney(given - total)}`
    else paymentHint = 'Paiement complet.'
  }

  const resetForm = () => {
    setSavedCart([])
    setCustomerId('')
    setPaidInput(null)
    setSearch('')
  }

  // Mobile money : la vente est créée impayée (stock réservé), puis la demande
  // de paiement est ouverte chez le prestataire et on attend le client.
  const submitMobile = async () => {
    setServerError(null)
    setNotice(null)
    let sale
    try {
      sale = await createSale.mutateAsync({
        customerId: customerId ? Number(customerId) : null,
        paidAmount: 0,
        items: toSaleItems(cart),
        expectedTotal: total,
        mobile: true,
      })
    } catch (error) {
      setServerError(errorMessage(error))
      return
    }
    try {
      const payment = await startPayment.mutateAsync({ saleId: sale.id })
      setMobilePhase('waiting')
      setMobileSale({ ...sale, payment, cart })
      resetForm()
    } catch (error) {
      // Refus du prestataire : le serveur annule la vente et rend le stock.
      // Si la vente existe encore (panne en cours de route), elle reste à reprendre.
      const kept = await saleExists(sale.id).catch(() => true)
      if (kept) resetForm()
      setServerError(
        kept
          ? `${errorMessage(error)} La vente n° ${sale.number} reste enregistrée, en attente de paiement mobile : reprenez-la depuis la liste des ventes.`
          : `${errorMessage(error)} La vente n’a pas été enregistrée et le stock a été rendu.`,
      )
    }
  }

  const onMobileFinal = (phase) => {
    if (phase === 'completed') {
      setLastSale({ id: mobileSale.id, number: mobileSale.number, change: 0, mobile: true })
      toast.success(`Vente n° ${mobileSale.number} payée par mobile money.`)
    } else if (phase === 'sale_cancelled' || phase === 'cancelled') {
      // La vente n'a pas eu lieu : le panier revient, pour un paiement en espèces par exemple.
      setSavedCart(mobileSale.cart)
      setNotice(`Vente n° ${mobileSale.number} annulée : le stock a été rendu et le panier est de nouveau affiché.`)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSell || cart.length === 0 || createSale.isPending || startPayment.isPending) return
    if (mobile) return submitMobile()
    if (paymentError) return
    if (due > 0 && !customerId) {
      setCustomerError('Choisissez un client : une vente à crédit doit être rattachée à un client.')
      return
    }
    setServerError(null)
    try {
      const sale = await createSale.mutateAsync({
        customerId: customerId ? Number(customerId) : null,
        // On n'enregistre jamais plus que le total : le surplus est la monnaie rendue.
        paidAmount: Math.min(given, total),
        items: toSaleItems(cart),
        expectedTotal: total,
      })
      setLastSale({ ...sale, change: Math.max(0, given - total) })
      resetForm()
      toast.success(`Vente n° ${sale.number} enregistrée.`)
    } catch (error) {
      // Stock insuffisant, prix modifié… : useCreateSale recharge le catalogue
      // et le panier affiché se resynchronise (quantités et prix).
      setServerError(errorMessage(error))
    }
  }

  if (medicines.isPending) return <PageLoader fullScreen={false} label="Chargement du catalogue…" />

  return (
    <>
      <PageHeader title="Nouvelle vente" subtitle="Ajoutez les médicaments au panier, puis encaissez." />

      {!canSell ? (
        <Alert tone="warning" title="La caisse est désactivée" className={shared.pageAlert}>
          Aucune vente ne peut être enregistrée tant que l’abonnement de la pharmacie n’est pas renouvelé.
        </Alert>
      ) : null}

      {medicines.isError ? <LoadError query={medicines} /> : null}

      {lastSale ? (
        <Alert
          tone="success"
          title={`Vente n° ${lastSale.number} enregistrée`}
          className={shared.pageAlert}
          action={
            <Button as={Link} to={`/ventes/${lastSale.id}`} variant="secondary" size="sm">
              Voir la vente
            </Button>
          }
        >
          {lastSale.mobile
            ? 'Payée par mobile money. Le stock a été mis à jour.'
            : lastSale.change > 0
              ? `Monnaie à rendre : ${formatMoney(lastSale.change)}`
              : 'Le stock a été mis à jour.'}
        </Alert>
      ) : null}

      {notice ? (
        <Alert tone="info" className={shared.pageAlert}>
          {notice}
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
                    disabled={!canSell || quantityInCart(medicine.id) >= medicine.quantity}
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
                        <QuantityInput
                          line={line}
                          onChange={(quantity) => updateCart(setQuantity(cart, line.medicine_id, quantity))}
                        />
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
              {mobileEnabled ? (
                <fieldset className={styles.modes}>
                  <legend className={styles.modesLegend}>Mode de paiement</legend>
                  <label className={styles.mode}>
                    <input type="radio" name="mode-paiement" value="cash" checked={mode === 'cash'} onChange={() => setMode('cash')} />
                    <Banknote size={18} aria-hidden="true" />
                    Espèces
                  </label>
                  <label className={styles.mode}>
                    <input type="radio" name="mode-paiement" value="mobile" checked={mode === 'mobile'} onChange={() => setMode('mobile')} />
                    <Smartphone size={18} aria-hidden="true" />
                    Mobile money
                  </label>
                </fieldset>
              ) : null}
              <Field
                label="Client"
                htmlFor="caisse-client"
                error={mobile ? null : customerError}
                hint={mobile ? 'Facultatif.' : 'Obligatoire pour une vente à crédit.'}
              >
                <Select
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value)
                    setCustomerError(null)
                  }}
                >
                  <option value="">{customers.isPending ? 'Chargement des clients…' : 'Client de passage'}</option>
                  {(customers.data ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {customers.isError ? (
                <Alert
                  tone="warning"
                  title="La liste des clients n’a pas pu être chargée"
                  action={
                    <Button size="sm" variant="secondary" loading={customers.isFetching} onClick={() => customers.refetch()}>
                      Réessayer
                    </Button>
                  }
                >
                  Seule une vente au comptant (client de passage) est possible pour le moment.
                </Alert>
              ) : null}
              {mobile ? (
                cart.length > 0 ? (
                  <p className={styles.mobileHint}>
                    Le client paie {formatMoney(total)} avec Wave ou Orange Money : un code QR s’affichera à l’étape suivante.
                  </p>
                ) : null
              ) : (
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
              )}
              {serverError ? (
                <Alert tone="danger" title="Vente non enregistrée">
                  {serverError}
                </Alert>
              ) : null}
              <Button
                type="submit"
                fullWidth
                icon={mobile ? Smartphone : Receipt}
                disabled={!canSell || cart.length === 0}
                loading={createSale.isPending || startPayment.isPending}
              >
                {mobile ? 'Demander le paiement mobile' : 'Enregistrer la vente'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Modal
        open={mobileSale !== null}
        onClose={() => setMobileSale(null)}
        title="Paiement par mobile money"
        size="sm"
        // Pas de fermeture par accident (Échap, clic à côté) tant que le paiement est en attente.
        dismissible={isFinalPhase(mobilePhase)}
        footer={
          isFinalPhase(mobilePhase) ? (
            <Button onClick={() => setMobileSale(null)}>Fermer</Button>
          ) : (
            <Button variant="ghost" onClick={() => setMobileSale(null)} title="La vente reste en attente : elle se reprend depuis la liste des ventes.">
              Continuer plus tard
            </Button>
          )
        }
      >
        {mobileSale ? (
          <MobilePaymentPanel payment={mobileSale.payment} saleNumber={mobileSale.number} onFinal={onMobileFinal} onPhase={setMobilePhase} />
        ) : null}
      </Modal>
    </>
  )
}
