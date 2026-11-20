import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CalendarClock,
  ClipboardList,
  Clock,
  Download,
  LayoutDashboard,
  LogIn,
  Minus,
  PackageSearch,
  Pencil,
  Pill,
  Plus,
  Receipt,
  ShoppingCart,
  Tags,
  Trash2,
  TrendingUp,
  Truck,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { AppShell } from '../components/layout/AppShell.jsx'
import { AuthLayout } from '../components/layout/AuthLayout.jsx'
import {
  Alert,
  Badge,
  BarChart,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormGrid,
  FullRow,
  Grid,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  Spinner,
  StatCard,
  Textarea,
  Toolbar,
  useToast,
} from '../components/ui'
import styles from './DesignPreview.module.css'

/**
 * Page de démonstration du design system (route /apercu) : tous les composants
 * du kit dans AppShell, avec des données fictives. Aucune donnée réelle, aucun appel réseau.
 * Exporte aussi LoginPreview (/apercu/connexion) et PendingPreview (/apercu/attente).
 */

const fcfa = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`
const compact = (n) => (n >= 1000 ? `${Math.round(n / 1000)} k` : String(n))

const NAV_ITEMS = [
  { to: '/apercu', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/apercu/nouvelle-vente', label: 'Nouvelle vente', icon: ShoppingCart },
  { to: '/apercu/ventes', label: 'Ventes', icon: Receipt },
  { to: '/apercu/medicaments', label: 'Médicaments', icon: Pill },
  { to: '/apercu/categories', label: 'Catégories', icon: Tags },
  { to: '/apercu/clients', label: 'Clients', icon: Users },
  { to: '/apercu/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/apercu/utilisateurs', label: 'Utilisateurs', icon: UserCog },
]

const DEMO_USER = { name: 'Awa Ndiaye', email: 'awa.ndiaye@exemple.sn', role: 'pharmacien' }

const MEDICINES = [
  { id: 1, name: 'Doliprane 1000 mg', generic: 'Paracétamol', category: 'Antalgique', price: 1800, stock: 38, expiry: '01/2027', status: 'ok' },
  { id: 2, name: 'Amoxicilline 500 mg', generic: 'Amoxicilline', category: 'Antibiotique', price: 2500, stock: 6, expiry: '06/2027', status: 'low' },
  { id: 3, name: 'Efferalgan 500 mg', generic: 'Paracétamol', category: 'Antalgique', price: 1200, stock: 60, expiry: '12/2026', status: 'soon' },
  { id: 4, name: 'Spasfon Lyoc 80 mg', generic: 'Phloroglucinol', category: 'Antispasmodique', price: 2100, stock: 15, expiry: '03/2028', status: 'ok' },
  { id: 5, name: 'Smecta 3 g', generic: 'Diosmectite', category: 'Gastro-entérologie', price: 3000, stock: 0, expiry: '09/2027', status: 'out' },
  { id: 6, name: 'Coartem 20/120 mg', generic: 'Artéméther, luméfantrine', category: 'Antipaludique', price: 4500, stock: 22, expiry: '10/2026', status: 'expired' },
]

const STATUS = {
  ok: { tone: 'success', label: 'En stock' },
  low: { tone: 'warning', label: 'Stock bas' },
  soon: { tone: 'warning', label: 'Expire bientôt' },
  out: { tone: 'neutral', label: 'Rupture' },
  expired: { tone: 'danger', label: 'Périmé' },
}

const WEEK_SALES = [
  { label: 'Sam.', value: 212000 },
  { label: 'Dim.', value: 64000 },
  { label: 'Lun.', value: 158500 },
  { label: 'Mar.', value: 143000 },
  { label: 'Mer.', value: 176000 },
  { label: 'Jeu.', value: 121500 },
  { label: 'Ven.', value: 184500 },
]

const RECENT_SALES = [
  { id: 'V-2031', time: '16:42', customer: 'Client de passage', total: 12500, paid: 12500 },
  { id: 'V-2030', time: '16:10', customer: 'Moussa Diop', total: 27600, paid: 15000 },
  { id: 'V-2029', time: '15:37', customer: 'Fatou Sarr', total: 4800, paid: 4800 },
  { id: 'V-2028', time: '14:55', customer: 'Client de passage', total: 9300, paid: 0 },
]

const INITIAL_CART = [
  { id: 1, name: 'Doliprane 1000 mg', price: 1800, qty: 2 },
  { id: 4, name: 'Spasfon Lyoc 80 mg', price: 2100, qty: 1 },
]

function Section({ title, description, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function paymentBadge(sale) {
  if (sale.paid >= sale.total) return <Badge tone="success">Payée</Badge>
  if (sale.paid > 0) return <Badge tone="warning">Reste {fcfa(sale.total - sale.paid)}</Badge>
  return <Badge tone="danger">Impayée</Badge>
}

export function DesignPreview() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [tableLoading, setTableLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cart, setCart] = useState(INITIAL_CART)
  const [cartQuery, setCartQuery] = useState('')
  const [paid, setPaid] = useState('10000')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return MEDICINES.filter(
      (m) =>
        (!category || m.category === category) &&
        (!needle || m.name.toLowerCase().includes(needle) || m.generic.toLowerCase().includes(needle)),
    )
  }, [query, category])

  const catalogue = useMemo(() => {
    const needle = cartQuery.trim().toLowerCase()
    return MEDICINES.filter((m) => !needle || m.name.toLowerCase().includes(needle)).slice(0, 5)
  }, [cartQuery])

  const total = cart.reduce((sum, line) => sum + line.price * line.qty, 0)
  const paidAmount = Number(paid) || 0
  const change = paidAmount - total

  const addToCart = (medicine) =>
    setCart((lines) =>
      lines.some((l) => l.id === medicine.id)
        ? lines.map((l) => (l.id === medicine.id ? { ...l, qty: l.qty + 1 } : l))
        : [...lines, { id: medicine.id, name: medicine.name, price: medicine.price, qty: 1 }],
    )
  const changeQty = (id, delta) =>
    setCart((lines) => lines.map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0))

  const openForm = (medicine = null) => {
    setEditing(medicine)
    setFormOpen(true)
  }

  const submitForm = (event) => {
    event.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setFormOpen(false)
      toast.success(editing ? 'Médicament modifié.' : 'Médicament ajouté.')
    }, 700)
  }

  const confirmDelete = () => {
    setDeleting(true)
    setTimeout(() => {
      setDeleting(false)
      setToDelete(null)
      toast.success('Médicament supprimé.')
    }, 700)
  }

  const medicineColumns = [
    {
      key: 'name',
      header: 'Médicament',
      render: (m) => (
        <div className={styles.medicine}>
          <span className={styles.medicineName}>{m.name}</span>
          <span className={styles.medicineGeneric}>{m.generic}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Catégorie' },
    { key: 'price', header: 'Prix', align: 'right', render: (m) => fcfa(m.price) },
    { key: 'stock', header: 'Stock', align: 'right', width: '5.5rem' },
    { key: 'expiry', header: 'Péremption', width: '7.5rem' },
    { key: 'status', header: 'État', render: (m) => <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '6.5rem',
      render: (m) => (
        <div className={styles.rowActions}>
          <IconButton icon={Pencil} label={`Modifier ${m.name}`} onClick={() => openForm(m)} />
          <IconButton icon={Trash2} label={`Supprimer ${m.name}`} variant="danger" onClick={() => setToDelete(m)} />
        </div>
      ),
    },
  ]

  const saleColumns = [
    { key: 'id', header: 'N°', width: '5.5rem' },
    { key: 'time', header: 'Heure', width: '5rem' },
    { key: 'customer', header: 'Client' },
    { key: 'total', header: 'Total', align: 'right', render: (s) => fcfa(s.total) },
    { key: 'payment', header: 'Paiement', render: paymentBadge },
  ]

  return (
    <AppShell
      user={DEMO_USER}
      navItems={NAV_ITEMS}
      brandHint="Officine du Plateau, Dakar"
      onSignOut={() => toast.info('Déconnexion (démonstration).')}
    >
      <PageHeader
        title="Tableau de bord"
        subtitle="Aperçu du design system : tous les composants du kit, avec des données fictives."
        actions={
          <>
            <Button variant="secondary" icon={Download}>
              Exporter
            </Button>
            <Button icon={ShoppingCart}>Nouvelle vente</Button>
          </>
        }
      />

      <Alert
        tone="warning"
        title="3 médicaments expirent dans moins de 30 jours"
        action={
          <Button variant="secondary" size="sm">
            Voir la liste
          </Button>
        }
      >
        Retirez-les du rayon ou prévoyez un retour fournisseur.
      </Alert>

      <Section title="Indicateurs">
        <Grid min="15rem">
          <StatCard label="Ventes du jour" value={fcfa(184500)} hint="23 ventes depuis l’ouverture" icon={Banknote} tone="success" />
          <StatCard label="Ventes du mois" value={fcfa(3915000)} hint="Novembre, 20 jours écoulés" icon={TrendingUp} />
          <StatCard label="Valeur du stock" value={fcfa(4862500)} hint="412 références" icon={PackageSearch} />
          <StatCard label="Stock bas" value="7" hint="Sous le seuil de réapprovisionnement" icon={TriangleAlert} tone="warning" />
          <StatCard label="Périmés ou bientôt périmés" value="3" hint="1 périmé, 2 sous 30 jours" icon={CalendarClock} tone="danger" />
          <StatCard label="Impayés" value={fcfa(126000)} hint="5 ventes à encaisser" icon={Wallet} tone="info" />
        </Grid>
      </Section>

      <div className={styles.split}>
        <Card title="Ventes des 7 derniers jours" subtitle="En milliers de FCFA">
          <BarChart data={WEEK_SALES} formatValue={compact} highlight={WEEK_SALES.length - 1} label="Ventes des 7 derniers jours" />
        </Card>
        <Card title="Dernières ventes" actions={<Button variant="ghost" size="sm">Tout voir</Button>} padded={false}>
          <ul className={styles.saleList}>
            {RECENT_SALES.map((sale) => (
              <li key={sale.id} className={styles.saleItem}>
                <div className={styles.saleMain}>
                  <span className={styles.saleCustomer}>{sale.customer}</span>
                  <span className={styles.saleMeta}>
                    {sale.id}, {sale.time}
                  </span>
                </div>
                <div className={styles.saleAmount}>
                  <span data-numeric>{fcfa(sale.total)}</span>
                  {paymentBadge(sale)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Section title="Table de données" description="Recherche, filtre, actions par ligne. Sur téléphone, les lignes deviennent des cartes (mobileCards).">
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un médicament…" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie" className={styles.filter}>
            <option value="">Toutes les catégories</option>
            {[...new Set(MEDICINES.map((m) => m.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <div className={styles.toolbarActions}>
            <Button variant="ghost" onClick={() => setTableLoading((v) => !v)}>
              {tableLoading ? 'Arrêter le chargement' : 'Simuler le chargement'}
            </Button>
            <Button icon={Plus} onClick={() => openForm()}>
              Ajouter un médicament
            </Button>
          </div>
        </Toolbar>
        <DataTable
          caption="Liste des médicaments"
          columns={medicineColumns}
          rows={filtered}
          rowKey={(m) => m.id}
          loading={tableLoading}
          mobileCards
          minWidth="52rem"
          empty={
            <EmptyState
              compact
              icon={PackageSearch}
              title="Aucun médicament trouvé"
              message="Vérifiez l’orthographe ou retirez le filtre de catégorie."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setCategory('')
                  }}
                >
                  Effacer les filtres
                </Button>
              }
            />
          }
        />
        <p className={styles.note}>Variante à lignes cliquables et défilement horizontal sur téléphone :</p>
        <DataTable
          caption="Ventes du jour"
          columns={saleColumns}
          rows={RECENT_SALES}
          rowKey={(s) => s.id}
          onRowClick={(s) => toast.info(`Détail de la vente ${s.id}`)}
        />
      </Section>

      <Section title="Caisse" description="Disposition type pour « Nouvelle vente » : recherche à gauche, panier à droite.">
        <div className={styles.pos}>
          <Card title="Médicaments">
            <SearchInput value={cartQuery} onChange={setCartQuery} placeholder="Nom du médicament…" />
            <ul className={styles.catalogue}>
              {catalogue.map((m) => (
                <li key={m.id} className={styles.catalogueItem}>
                  <div className={styles.medicine}>
                    <span className={styles.medicineName}>{m.name}</span>
                    <span className={styles.medicineGeneric}>
                      {m.stock > 0 ? `${m.stock} en stock` : 'Rupture de stock'}
                    </span>
                  </div>
                  <span className={styles.cataloguePrice} data-numeric>
                    {fcfa(m.price)}
                  </span>
                  <Button variant="secondary" size="sm" icon={Plus} disabled={m.stock === 0} onClick={() => addToCart(m)}>
                    Ajouter
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Panier" actions={<Badge tone="info">{cart.reduce((n, l) => n + l.qty, 0)} articles</Badge>}>
            {cart.length === 0 ? (
              <EmptyState compact icon={ShoppingCart} title="Le panier est vide" message="Ajoutez un médicament depuis la liste." />
            ) : (
              <ul className={styles.cart}>
                {cart.map((line) => (
                  <li key={line.id} className={styles.cartLine}>
                    <div className={styles.medicine}>
                      <span className={styles.medicineName}>{line.name}</span>
                      <span className={styles.medicineGeneric} data-numeric>
                        {fcfa(line.price)} l’unité
                      </span>
                    </div>
                    <div className={styles.stepper}>
                      <IconButton icon={Minus} label={`Retirer un ${line.name}`} onClick={() => changeQty(line.id, -1)} />
                      <span className={styles.qty} data-numeric aria-label={`Quantité : ${line.qty}`}>
                        {line.qty}
                      </span>
                      <IconButton icon={Plus} label={`Ajouter un ${line.name}`} onClick={() => changeQty(line.id, 1)} />
                    </div>
                    <span className={styles.lineTotal} data-numeric>
                      {fcfa(line.price * line.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.totalRow}>
              <span>Total à payer</span>
              <strong data-numeric>{fcfa(total)}</strong>
            </div>
            <Field
              label="Montant payé"
              htmlFor="apercu-paye"
              hint={change >= 0 ? `Monnaie à rendre : ${fcfa(change)}` : `Reste dû : ${fcfa(-change)} (vente à crédit)`}
            >
              <Input type="number" inputMode="numeric" min="0" step="100" suffix="FCFA" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
            <div className={styles.posSubmit}>
              <Button fullWidth icon={Receipt} disabled={cart.length === 0} onClick={() => toast.success('Vente enregistrée.')}>
                Enregistrer la vente
              </Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Boutons et étiquettes">
        <Card>
          <div className={styles.demoRows}>
            <div className={styles.demoRow}>
              <Button>Enregistrer</Button>
              <Button variant="secondary">Annuler</Button>
              <Button variant="ghost">Voir le détail</Button>
              <Button variant="danger" icon={Trash2}>
                Supprimer
              </Button>
              <Button loading>Enregistrement…</Button>
              <Button disabled>Indisponible</Button>
            </div>
            <div className={styles.demoRow}>
              <Button size="sm" icon={Plus}>
                Ajouter
              </Button>
              <Button size="sm" variant="secondary" icon={Download}>
                Exporter
              </Button>
              <Button size="sm" variant="ghost">
                Réinitialiser
              </Button>
              <IconButton icon={Pencil} label="Modifier" />
              <IconButton icon={Trash2} label="Supprimer" variant="danger" />
              <Spinner />
            </div>
            <div className={styles.demoRow}>
              <Badge>Brouillon</Badge>
              <Badge tone="success">Payée</Badge>
              <Badge tone="warning">Stock bas</Badge>
              <Badge tone="danger">Périmé</Badge>
              <Badge tone="info">Nouveau</Badge>
              <Badge tone="warning" icon={Clock}>
                En attente
              </Badge>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Formulaire">
        <Card>
          <FormGrid>
            <Field label="Nom commercial" htmlFor="apercu-nom" required>
              <Input defaultValue="Doliprane 1000 mg" />
            </Field>
            <Field label="Catégorie" htmlFor="apercu-categorie" required>
              <Select defaultValue="Antalgique">
                <option>Antalgique</option>
                <option>Antibiotique</option>
                <option>Antipaludique</option>
              </Select>
            </Field>
            <Field label="Prix de vente" htmlFor="apercu-prix" required error="Saisissez un prix supérieur à 0.">
              <Input type="number" inputMode="numeric" suffix="FCFA" defaultValue="0" />
            </Field>
            <Field label="Quantité en stock" htmlFor="apercu-stock" hint="Nombre de boîtes en rayon et en réserve.">
              <Input type="number" inputMode="numeric" defaultValue="38" />
            </Field>
            <Field label="Fournisseur" htmlFor="apercu-fournisseur">
              <Input defaultValue="Laborex Sénégal" disabled />
            </Field>
            <Field label="Date de péremption" htmlFor="apercu-peremption">
              <Input type="month" defaultValue="2027-01" />
            </Field>
            <FullRow>
              <Field label="Remarques" htmlFor="apercu-remarques">
                <Textarea placeholder="Conditions de conservation, emplacement en rayon…" />
              </Field>
            </FullRow>
          </FormGrid>
        </Card>
      </Section>

      <Section title="Messages et états">
        <div className={styles.messages}>
          <Alert tone="info" title="Inventaire prévu samedi">
            Les ventes restent possibles pendant le comptage.
          </Alert>
          <Alert tone="success">La vente V-2031 a été enregistrée.</Alert>
          <Alert tone="warning" title="Stock bas">
            Amoxicilline 500 mg : 6 boîtes restantes.
          </Alert>
          <Alert tone="danger" title="Enregistrement impossible">
            La connexion a été interrompue. Vérifiez le réseau puis réessayez.
          </Alert>
        </div>
        <div className={styles.split}>
          <Card title="Notifications et fenêtres">
            <div className={styles.demoRow}>
              <Button variant="secondary" onClick={() => toast.success('Client ajouté.')}>
                Toast de succès
              </Button>
              <Button variant="secondary" onClick={() => toast.error('La vente n’a pas pu être enregistrée. Réessayez.')}>
                Toast d’erreur
              </Button>
              <Button variant="secondary" onClick={() => toast.info('3 médicaments expirent bientôt.')}>
                Toast d’information
              </Button>
              <Button onClick={() => openForm(MEDICINES[0])}>Ouvrir la modale</Button>
              <Button variant="danger" onClick={() => setToDelete(MEDICINES[4])}>
                Ouvrir la confirmation
              </Button>
            </div>
          </Card>
          <Card title="Chargement" padded={false}>
            <PageLoader fullScreen={false} label="Chargement des ventes…" />
          </Card>
        </div>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Aucune vente aujourd’hui"
            message="Les ventes enregistrées à la caisse apparaîtront ici."
            action={<Button icon={ShoppingCart}>Nouvelle vente</Button>}
          />
        </Card>
      </Section>

      <Section title="Écrans hors session" description="AuthLayout sert à la connexion et à l’écran « compte en attente d’activation ».">
        <div className={styles.demoRow}>
          <Button as={Link} to="/apercu/connexion" variant="secondary" icon={LogIn}>
            Voir l’écran de connexion
          </Button>
          <Button as={Link} to="/apercu/attente" variant="secondary" icon={Clock}>
            Voir l’écran d’attente
          </Button>
        </div>
      </Section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le médicament' : 'Ajouter un médicament'}
        description="Les champs marqués d’un astérisque sont obligatoires."
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" form="apercu-form-medicament" loading={saving}>
              {editing ? 'Enregistrer les modifications' : 'Ajouter le médicament'}
            </Button>
          </>
        }
      >
        <form id="apercu-form-medicament" onSubmit={submitForm}>
          <FormGrid>
            <Field label="Nom commercial" htmlFor="m-nom" required>
              <Input defaultValue={editing?.name} placeholder="ex. Doliprane 1000 mg" required />
            </Field>
            <Field label="Dénomination commune (DCI)" htmlFor="m-dci">
              <Input defaultValue={editing?.generic} placeholder="ex. Paracétamol" />
            </Field>
            <Field label="Catégorie" htmlFor="m-categorie" required>
              <Select defaultValue={editing?.category ?? ''} required>
                <option value="" disabled>
                  Choisir une catégorie
                </option>
                {[...new Set(MEDICINES.map((m) => m.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date de péremption" htmlFor="m-peremption" required>
              <Input type="month" defaultValue="2027-01" required />
            </Field>
            <Field label="Prix de vente" htmlFor="m-prix" required>
              <Input type="number" inputMode="numeric" min="0" suffix="FCFA" defaultValue={editing?.price} required />
            </Field>
            <Field label="Quantité en stock" htmlFor="m-stock" required hint="En nombre de boîtes.">
              <Input type="number" inputMode="numeric" min="0" defaultValue={editing?.stock} required />
            </Field>
          </FormGrid>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete != null}
        title="Supprimer ce médicament ?"
        message={
          <>
            <strong>{toDelete?.name}</strong> sera retiré du catalogue. Les ventes déjà enregistrées sont conservées.
          </>
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </AppShell>
  )
}

export function LoginPreview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  return (
    <AuthLayout
      title="Connexion"
      subtitle="Entrez vos identifiants pour ouvrir votre session."
      footer={
        <>
          Pas encore de compte ? Demandez à l’administrateur de la pharmacie de vous en créer un.{' '}
          <Link to="/apercu">Retour à l’aperçu</Link>
        </>
      }
    >
      <form
        className={styles.authForm}
        onSubmit={(event) => {
          event.preventDefault()
          setLoading(true)
          setError(false)
          setTimeout(() => {
            setLoading(false)
            setError(true)
          }, 800)
        }}
      >
        {error ? <Alert tone="danger">Adresse e-mail ou mot de passe incorrect.</Alert> : null}
        <Field label="Adresse e-mail" htmlFor="connexion-email">
          <Input type="email" autoComplete="username" placeholder="prenom.nom@exemple.sn" required />
        </Field>
        <Field label="Mot de passe" htmlFor="connexion-mdp">
          <Input type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" fullWidth loading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  )
}

export function PendingPreview() {
  return (
    <AuthLayout
      title="Compte en attente d’activation"
      subtitle="Votre compte a bien été créé. Un administrateur doit encore l’activer et vous attribuer un rôle."
      footer={<Link to="/apercu">Retour à l’aperçu</Link>}
    >
      <div className={styles.authForm}>
        <Alert tone="info" title="Que faire maintenant ?">
          Prévenez l’administrateur de la pharmacie, puis revenez sur cette page une fois le compte activé.
        </Alert>
        <Button fullWidth>Vérifier à nouveau</Button>
        <Button fullWidth variant="ghost">
          Se déconnecter
        </Button>
      </div>
    </AuthLayout>
  )
}

export default DesignPreview
