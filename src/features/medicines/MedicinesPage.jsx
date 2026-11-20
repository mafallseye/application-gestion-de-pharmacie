import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageSearch, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormGrid,
  IconButton,
  Input,
  PageHeader,
  SearchInput,
  Select,
  Toolbar,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { errorMessage } from '../../lib/errors.js'
import { formatDate, formatMoney, formatNumber } from '../../lib/format.js'
import { validateMedicine } from '../../lib/validation.js'
import { useCategories } from '../categories/api.js'
import { FormModal } from '../shared/FormModal.jsx'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { useSuppliers } from '../suppliers/api.js'
import { useDeleteMedicine, useMedicines, useSaveMedicine } from './api.js'
import { MEDICINE_STATUS_FILTERS, filterMedicines } from './filters.js'
import { STATUS_OPTIONS, medicineBadges } from './status.js'

const EMPTY = {
  brand_name: '',
  generic_name: '',
  category_id: '',
  supplier_id: '',
  price: '',
  quantity: '',
  low_stock_threshold: '10',
  expiry_date: '',
}

function toFormValues(medicine) {
  if (!medicine) return EMPTY
  return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, String(medicine[key] ?? '')]))
}

export default function MedicinesPage() {
  usePageTitle('Médicaments')
  const toast = useToast()
  const { isManager } = useAuth()
  const medicines = useMedicines()
  const categories = useCategories()
  const suppliers = useSuppliers()
  const save = useSaveMedicine()
  const remove = useDeleteMedicine()

  // Les filtres vivent dans l'URL (?etat=…&categorie=…) : le tableau de bord y renvoie.
  const [params, setParams] = useSearchParams()
  const status = MEDICINE_STATUS_FILTERS[params.get('etat')] ? params.get('etat') : ''
  const categoryId = params.get('categorie') ?? ''
  const setParam = (name, value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(undefined) // undefined : fermé ; null : création
  const [toDelete, setToDelete] = useState(null)

  const rows = useMemo(
    () => filterMedicines(medicines.data, { search, categoryId, status }),
    [medicines.data, search, categoryId, status],
  )
  const filtering = search.trim() !== '' || categoryId !== '' || status !== ''
  const clearFilters = () => {
    setSearch('')
    setParams({}, { replace: true })
  }

  const columns = useMemo(() => {
    const base = [
      {
        key: 'brand_name',
        header: 'Médicament',
        render: (m) => (
          <div className={shared.stacked}>
            <span className={shared.primary}>{m.brand_name}</span>
            {m.generic_name ? <span className={shared.secondary}>{m.generic_name}</span> : null}
          </div>
        ),
      },
      { key: 'category', header: 'Catégorie', render: (m) => m.category?.name ?? '—' },
      { key: 'supplier', header: 'Fournisseur', render: (m) => m.supplier?.name ?? '—' },
      { key: 'price', header: 'Prix', align: 'right', render: (m) => <span className={shared.nowrap}>{formatMoney(m.price)}</span> },
      { key: 'quantity', header: 'Stock', align: 'right', width: '5.5rem', render: (m) => formatNumber(m.quantity) },
      { key: 'expiry_date', header: 'Péremption', width: '7.5rem', render: (m) => formatDate(m.expiry_date) },
      {
        key: 'status',
        header: 'État',
        render: (m) => (
          <span className={shared.badges}>
            {medicineBadges(m).map((badge) => (
              <Badge key={badge.label} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}
          </span>
        ),
      },
    ]
    if (!isManager) return base
    return [
      ...base,
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '6.5rem',
        render: (m) => (
          <div className={shared.rowActions}>
            <IconButton icon={Pencil} label={`Modifier ${m.brand_name}`} onClick={() => setEditing(m)} />
            <IconButton icon={Trash2} label={`Supprimer ${m.brand_name}`} variant="danger" onClick={() => setToDelete(m)} />
          </div>
        ),
      },
    ]
  }, [isManager])

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(toDelete.id)
      setToDelete(null)
      toast.success('Médicament supprimé.')
    } catch (error) {
      setToDelete(null)
      toast.error(errorMessage(error))
    }
  }

  const saveMedicine = (values) => {
    if (!editing) return save.mutateAsync(values)
    // Stock inchangé dans le formulaire : on ne le renvoie pas, pour ne pas
    // écraser une vente enregistrée à la caisse pendant la saisie.
    const quantity = values.quantity === editing.quantity ? undefined : values.quantity
    return save.mutateAsync({ id: editing.id, ...values, quantity })
  }

  const addButton = isManager ? (
    <Button icon={Plus} onClick={() => setEditing(null)}>
      Ajouter un médicament
    </Button>
  ) : null

  return (
    <>
      <PageHeader title="Médicaments" subtitle="Catalogue, stock et dates de péremption." actions={addButton} />

      {medicines.isError ? (
        <LoadError query={medicines} />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un médicament…" />
            <div className={shared.filters}>
              <Select
                value={categoryId}
                onChange={(event) => setParam('categorie', event.target.value)}
                aria-label="Catégorie"
                className={shared.filter}
              >
                <option value="">Toutes les catégories</option>
                {(categories.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Select value={status} onChange={(event) => setParam('etat', event.target.value)} aria-label="État" className={shared.filter}>
                <option value="">Tous les états</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </Toolbar>
          <DataTable
            caption="Liste des médicaments"
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            loading={medicines.isPending}
            mobileCards
            minWidth="60rem"
            empty={
              filtering ? (
                <EmptyState
                  compact
                  icon={PackageSearch}
                  title="Aucun médicament trouvé"
                  message="Vérifiez l’orthographe ou retirez les filtres."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Effacer les filtres
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={PackageSearch}
                  title="Aucun médicament"
                  message="Le catalogue est vide pour le moment."
                  action={addButton}
                />
              )
            }
          />
        </>
      )}

      <FormModal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'Modifier le médicament' : 'Ajouter un médicament'}
        description="Les champs marqués d’un astérisque sont obligatoires."
        submitLabel={editing ? 'Enregistrer' : 'Ajouter le médicament'}
        successMessage={editing ? 'Médicament modifié.' : 'Médicament ajouté.'}
        initialValues={toFormValues(editing)}
        validate={validateMedicine}
        onSubmit={saveMedicine}
      >
        {({ errors, bind }) => (
          <FormGrid>
            <Field label="Nom commercial" htmlFor="medicament-nom" required error={errors.brand_name}>
              <Input {...bind('brand_name')} placeholder="ex. Doliprane 1000 mg" maxLength={160} />
            </Field>
            <Field label="Dénomination commune (DCI)" htmlFor="medicament-dci" error={errors.generic_name}>
              <Input {...bind('generic_name')} placeholder="ex. Paracétamol" maxLength={160} />
            </Field>
            <Field label="Catégorie" htmlFor="medicament-categorie" error={errors.category_id}>
              <Select {...bind('category_id')}>
                <option value="">Sans catégorie</option>
                {(categories.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fournisseur" htmlFor="medicament-fournisseur" error={errors.supplier_id}>
              <Select {...bind('supplier_id')}>
                <option value="">Sans fournisseur</option>
                {(suppliers.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prix de vente" htmlFor="medicament-prix" required error={errors.price}>
              <Input {...bind('price')} inputMode="numeric" suffix="FCFA" autoComplete="off" />
            </Field>
            <Field label="Date de péremption" htmlFor="medicament-peremption" error={errors.expiry_date}>
              <Input {...bind('expiry_date')} type="date" />
            </Field>
            <Field label="Quantité en stock" htmlFor="medicament-stock" required error={errors.quantity} hint="En nombre de boîtes.">
              <Input {...bind('quantity')} inputMode="numeric" autoComplete="off" />
            </Field>
            <Field
              label="Seuil d’alerte"
              htmlFor="medicament-seuil"
              error={errors.low_stock_threshold}
              hint="« Stock bas » dès que le stock atteint ce nombre."
            >
              <Input {...bind('low_stock_threshold')} inputMode="numeric" autoComplete="off" />
            </Field>
          </FormGrid>
        )}
      </FormModal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer ce médicament ?"
        message={
          <>
            <strong>{toDelete?.brand_name}</strong> sera retiré du catalogue. Les ventes déjà enregistrées sont conservées.
          </>
        }
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
