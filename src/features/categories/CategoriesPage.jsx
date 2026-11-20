import { Tags } from 'lucide-react'
import { Field, FormGrid, Input } from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'
import { validateCategory } from '../../lib/validation.js'
import { EntityPage } from '../shared/EntityPage.jsx'
import { searchCategories, useCategories, useDeleteCategory, useSaveCategory } from './api.js'

const EMPTY = { name: '', short_name: '' }

const COLUMNS = [
  { key: 'name', header: 'Nom', render: (row) => <strong>{row.name}</strong> },
  { key: 'short_name', header: 'Abréviation', render: (row) => row.short_name || '—' },
]

const LABELS = {
  name: (row) => row.name,
  add: 'Ajouter une catégorie',
  addTitle: 'Ajouter une catégorie',
  editTitle: 'Modifier la catégorie',
  created: 'Catégorie ajoutée.',
  updated: 'Catégorie modifiée.',
  deleted: 'Catégorie supprimée.',
  deleteTitle: 'Supprimer cette catégorie ?',
  deleteMessage: 'sera supprimée. Ses médicaments sont conservés, sans catégorie.',
  searchPlaceholder: 'Rechercher une catégorie…',
  emptyTitle: 'Aucune catégorie',
  emptyMessage: 'Les catégories servent à classer les médicaments.',
}

const fields = ({ errors, bind }) => (
  <FormGrid>
    <Field label="Nom" htmlFor="categorie-nom" required error={errors.name}>
      <Input {...bind('name')} placeholder="ex. Antalgiques" maxLength={120} />
    </Field>
    <Field label="Abréviation" htmlFor="categorie-abreviation" error={errors.short_name}>
      <Input {...bind('short_name')} placeholder="ex. ANT" maxLength={30} />
    </Field>
  </FormGrid>
)

export default function CategoriesPage() {
  const { isManager } = useAuth()
  return (
    <EntityPage
      title="Catégories"
      subtitle="Familles de médicaments du catalogue."
      icon={Tags}
      labels={LABELS}
      list={useCategories()}
      search={searchCategories}
      save={useSaveCategory()}
      remove={useDeleteCategory()}
      columns={COLUMNS}
      validate={validateCategory}
      emptyValues={EMPTY}
      fields={fields}
      canCreate={isManager}
      canEdit={isManager}
      canDelete={isManager}
    />
  )
}
