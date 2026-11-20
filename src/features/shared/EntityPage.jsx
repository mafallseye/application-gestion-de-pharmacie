import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  SearchInput,
  Toolbar,
  useToast,
} from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'
import { FormModal } from './FormModal.jsx'
import { LoadError } from './LoadError.jsx'
import { usePageTitle } from './usePageTitle.js'
import styles from './shared.module.css'

/**
 * Page « liste + modale » d'une entité simple (catégories, fournisseurs, clients).
 * Props :
 *  - title, subtitle, icon (état vide)
 *  - labels : { name(row), add, addTitle, editTitle, created, updated, deleted,
 *      deleteTitle, deleteMessage, searchPlaceholder, emptyTitle, emptyMessage }
 *  - list (résultat de useXxx), search(items, texte), save / remove (mutations)
 *  - columns : colonnes DataTable (la colonne d'actions est ajoutée ici)
 *  - validate, emptyValues (champs du formulaire, vides), fields({ errors, bind })
 *  - canCreate, canEdit, canDelete : droits de l'utilisateur connecté
 */
export function EntityPage({
  title,
  subtitle,
  icon,
  labels,
  list,
  search,
  save,
  remove,
  columns,
  validate,
  emptyValues,
  fields,
  canCreate = false,
  canEdit = false,
  canDelete = false,
}) {
  usePageTitle(title)
  const toast = useToast()
  const [query, setQuery] = useState('')
  // undefined : modale fermée ; null : création ; ligne : modification.
  const [editing, setEditing] = useState(undefined)
  const [toDelete, setToDelete] = useState(null)

  const rows = useMemo(() => search(list.data, query), [search, list.data, query])

  const allColumns = useMemo(() => {
    if (!canEdit && !canDelete) return columns
    const actions = {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '6.5rem',
      render: (row) => (
        <div className={styles.rowActions}>
          {canEdit ? <IconButton icon={Pencil} label={`Modifier ${labels.name(row)}`} onClick={() => setEditing(row)} /> : null}
          {canDelete ? (
            <IconButton icon={Trash2} label={`Supprimer ${labels.name(row)}`} variant="danger" onClick={() => setToDelete(row)} />
          ) : null}
        </div>
      ),
    }
    return [...columns, actions]
  }, [columns, canEdit, canDelete, labels])

  const initialValues = useMemo(() => {
    if (!editing) return emptyValues
    return Object.fromEntries(Object.keys(emptyValues).map((key) => [key, editing[key] ?? '']))
  }, [editing, emptyValues])

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(toDelete.id)
      setToDelete(null)
      toast.success(labels.deleted)
    } catch (error) {
      setToDelete(null)
      toast.error(errorMessage(error))
    }
  }

  const addButton = canCreate ? (
    <Button icon={Plus} onClick={() => setEditing(null)}>
      {labels.add}
    </Button>
  ) : null
  const filtering = query.trim() !== ''

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={addButton} />

      {list.isError ? (
        <LoadError query={list} />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder={labels.searchPlaceholder} />
          </Toolbar>
          <DataTable
            caption={title}
            columns={allColumns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={list.isPending}
            mobileCards
            empty={
              filtering ? (
                <EmptyState
                  compact
                  icon={icon}
                  title="Aucun résultat"
                  message="Aucune ligne ne correspond à cette recherche."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                      Effacer la recherche
                    </Button>
                  }
                />
              ) : (
                <EmptyState compact icon={icon} title={labels.emptyTitle} message={labels.emptyMessage} action={addButton} />
              )
            }
          />
        </>
      )}

      <FormModal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? labels.editTitle : labels.addTitle}
        description="Les champs marqués d’un astérisque sont obligatoires."
        submitLabel={editing ? 'Enregistrer' : labels.add}
        successMessage={editing ? labels.updated : labels.created}
        initialValues={initialValues}
        validate={validate}
        onSubmit={(values) => save.mutateAsync(editing ? { id: editing.id, ...values } : values)}
      >
        {fields}
      </FormModal>

      <ConfirmDialog
        open={toDelete !== null}
        title={labels.deleteTitle}
        message={
          <>
            <strong>{toDelete ? labels.name(toDelete) : ''}</strong> {labels.deleteMessage}
          </>
        }
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
