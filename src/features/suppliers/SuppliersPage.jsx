import { Truck } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { validateSupplier } from '../../lib/validation.js'
import { ContactFields } from '../shared/ContactFields.jsx'
import { CONTACT_COLUMNS, EMPTY_CONTACT } from '../shared/contact.js'
import { EntityPage } from '../shared/EntityPage.jsx'
import { searchSuppliers, useSuppliers, useDeleteSupplier, useSaveSupplier } from './api.js'

const LABELS = {
  name: (row) => row.name,
  add: 'Ajouter un fournisseur',
  addTitle: 'Ajouter un fournisseur',
  editTitle: 'Modifier le fournisseur',
  created: 'Fournisseur ajouté.',
  updated: 'Fournisseur modifié.',
  deleted: 'Fournisseur supprimé.',
  deleteTitle: 'Supprimer ce fournisseur ?',
  deleteMessage: 'sera supprimé. Ses médicaments sont conservés, sans fournisseur.',
  searchPlaceholder: 'Rechercher un fournisseur…',
  emptyTitle: 'Aucun fournisseur',
  emptyMessage: 'Les fournisseurs se rattachent ensuite aux médicaments.',
}

const fields = (form) => <ContactFields prefix="fournisseur" namePlaceholder="ex. Laborex Sénégal" {...form} />

export default function SuppliersPage() {
  const { isManager } = useAuth()
  return (
    <EntityPage
      title="Fournisseurs"
      subtitle="Grossistes et laboratoires qui approvisionnent la pharmacie."
      icon={Truck}
      labels={LABELS}
      list={useSuppliers()}
      search={searchSuppliers}
      save={useSaveSupplier()}
      remove={useDeleteSupplier()}
      columns={CONTACT_COLUMNS}
      validate={validateSupplier}
      emptyValues={EMPTY_CONTACT}
      fields={fields}
      canCreate={isManager}
      canEdit={isManager}
      canDelete={isManager}
    />
  )
}
