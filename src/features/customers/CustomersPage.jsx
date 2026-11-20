import { Users } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { validateCustomer } from '../../lib/validation.js'
import { ContactFields } from '../shared/ContactFields.jsx'
import { CONTACT_COLUMNS, EMPTY_CONTACT } from '../shared/contact.js'
import { EntityPage } from '../shared/EntityPage.jsx'
import { searchCustomers, useCustomers, useDeleteCustomer, useSaveCustomer } from './api.js'

const LABELS = {
  name: (row) => row.name,
  add: 'Ajouter un client',
  addTitle: 'Ajouter un client',
  editTitle: 'Modifier le client',
  created: 'Client ajouté.',
  updated: 'Client modifié.',
  deleted: 'Client supprimé.',
  deleteTitle: 'Supprimer ce client ?',
  deleteMessage: 'sera supprimé. Ses ventes sont conservées, avec son nom.',
  searchPlaceholder: 'Rechercher un client…',
  emptyTitle: 'Aucun client',
  emptyMessage: 'Enregistrez un client pour lui vendre à crédit.',
}

const fields = (form) => <ContactFields prefix="client" namePlaceholder="ex. Moussa Diop" {...form} />

export default function CustomersPage() {
  const { canSell, canManage } = useAuth()
  return (
    <EntityPage
      title="Clients"
      subtitle="Clients de la pharmacie, notamment pour les ventes à crédit."
      icon={Users}
      labels={LABELS}
      list={useCustomers()}
      search={searchCustomers}
      save={useSaveCustomer()}
      remove={useDeleteCustomer()}
      columns={CONTACT_COLUMNS}
      validate={validateCustomer}
      emptyValues={EMPTY_CONTACT}
      fields={fields}
      canCreate={canSell}
      canEdit={canSell}
      canDelete={canManage}
    />
  )
}
