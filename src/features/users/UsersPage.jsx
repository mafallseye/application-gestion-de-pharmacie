import { useMemo, useState } from 'react'
import { Clock, KeyRound, Pencil, Trash2, UserCog, UserPlus } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormGrid,
  FullRow,
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
import { ROLES, ROLE_LABELS, validatePassword, validateUser } from '../../lib/validation.js'
import { FormModal } from '../shared/FormModal.jsx'
import { LoadError } from '../shared/LoadError.jsx'
import { usePageTitle } from '../shared/usePageTitle.js'
import shared from '../shared/shared.module.css'
import { searchProfiles, useCreateUser, useDeleteUser, useProfiles, useSetUserPassword, useUpdateProfile } from './api.js'

const EMPTY_USER = { full_name: '', email: '', role: 'caissier', password: '' }
const displayName = (profile) => profile.full_name || profile.email

function RoleOptions() {
  return ROLES.map((role) => (
    <option key={role} value={role}>
      {ROLE_LABELS[role]}
    </option>
  ))
}

export default function UsersPage() {
  usePageTitle('Utilisateurs')
  const toast = useToast()
  const { user } = useAuth()
  const profiles = useProfiles()
  const createUser = useCreateUser()
  const updateProfile = useUpdateProfile()
  const setPassword = useSetUserPassword()
  const deleteUser = useDeleteUser()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [passwordFor, setPasswordFor] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const rows = useMemo(() => searchProfiles(profiles.data, search), [profiles.data, search])

  const columns = useMemo(
    () => [
      {
        key: 'full_name',
        header: 'Nom',
        render: (profile) => (
          <strong>
            {profile.full_name || '—'}
            {profile.id === user.id ? ' (vous)' : ''}
          </strong>
        ),
      },
      { key: 'email', header: 'E-mail' },
      { key: 'role', header: 'Rôle', render: (profile) => ROLE_LABELS[profile.role] ?? profile.role },
      {
        key: 'active',
        header: 'Statut',
        render: (profile) =>
          profile.active ? (
            <Badge tone="success">Actif</Badge>
          ) : (
            <Badge tone="warning" icon={Clock}>
              En attente
            </Badge>
          ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '9.5rem',
        render: (profile) => {
          // On n'agit pas sur son propre compte (la base le refuse aussi).
          const self = profile.id === user.id
          const name = displayName(profile)
          const selfNote = self ? ' (impossible sur votre propre compte)' : ''
          return (
            <div className={shared.rowActions}>
              <IconButton icon={Pencil} label={`Modifier ${name}${selfNote}`} disabled={self} onClick={() => setEditing(profile)} />
              <IconButton
                icon={KeyRound}
                label={`Changer le mot de passe de ${name}${selfNote}`}
                disabled={self}
                onClick={() => setPasswordFor(profile)}
              />
              <IconButton
                icon={Trash2}
                variant="danger"
                label={`Supprimer ${name}${selfNote}`}
                disabled={self}
                onClick={() => setToDelete(profile)}
              />
            </div>
          )
        },
      },
    ],
    [user.id],
  )

  const confirmDelete = async () => {
    try {
      await deleteUser.mutateAsync(toDelete.id)
      setToDelete(null)
      toast.success('Utilisateur supprimé.')
    } catch (error) {
      setToDelete(null)
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes du personnel, rôles et activation."
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Ajouter un utilisateur
          </Button>
        }
      />

      {profiles.isError ? (
        <LoadError query={profiles} />
      ) : (
        <>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un utilisateur…" />
          </Toolbar>
          <DataTable
            caption="Liste des utilisateurs"
            columns={columns}
            rows={rows}
            rowKey={(profile) => profile.id}
            loading={profiles.isPending}
            mobileCards
            minWidth="44rem"
            empty={<EmptyState compact icon={UserCog} title="Aucun utilisateur trouvé" message="Aucun compte ne correspond à cette recherche." />}
          />
        </>
      )}

      <FormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="Ajouter un utilisateur"
        description="Le compte est actif immédiatement. Communiquez le mot de passe à la personne concernée."
        submitLabel="Créer le compte"
        successMessage="Utilisateur créé."
        initialValues={EMPTY_USER}
        validate={(values) => validateUser(values, { mode: 'create' })}
        onSubmit={(values) => createUser.mutateAsync(values)}
      >
        {({ errors, bind }) => (
          <FormGrid>
            <Field label="Nom complet" htmlFor="utilisateur-nom" required error={errors.full_name}>
              <Input {...bind('full_name')} autoComplete="off" placeholder="ex. Fatou Sow" maxLength={120} />
            </Field>
            <Field label="Rôle" htmlFor="utilisateur-role" required error={errors.role}>
              <Select {...bind('role')}>
                <RoleOptions />
              </Select>
            </Field>
            <FullRow>
              <Field label="Adresse e-mail" htmlFor="utilisateur-email" required error={errors.email}>
                <Input {...bind('email')} type="email" autoComplete="off" placeholder="prenom.nom@exemple.sn" maxLength={255} />
              </Field>
            </FullRow>
            <FullRow>
              <Field label="Mot de passe" htmlFor="utilisateur-mdp" required error={errors.password} hint="Entre 8 et 72 caractères.">
                <Input {...bind('password')} type="password" autoComplete="new-password" />
              </Field>
            </FullRow>
          </FormGrid>
        )}
      </FormModal>

      <FormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Modifier l’utilisateur"
        description={editing?.email}
        submitLabel="Enregistrer"
        successMessage="Utilisateur modifié."
        initialValues={{ full_name: editing?.full_name ?? '', role: editing?.role ?? 'caissier', active: String(editing?.active ?? false) }}
        validate={(values) => validateUser(values, { mode: 'update' })}
        onSubmit={(values) => updateProfile.mutateAsync({ id: editing.id, ...values })}
      >
        {({ errors, bind }) => (
          <FormGrid>
            <FullRow>
              <Field label="Nom complet" htmlFor="profil-nom" required error={errors.full_name}>
                <Input {...bind('full_name')} autoComplete="off" maxLength={120} />
              </Field>
            </FullRow>
            <Field label="Rôle" htmlFor="profil-role" required error={errors.role}>
              <Select {...bind('role')}>
                <RoleOptions />
              </Select>
            </Field>
            <Field label="Statut" htmlFor="profil-statut" hint="Un compte en attente ne voit aucune donnée.">
              <Select {...bind('active')}>
                <option value="true">Actif</option>
                <option value="false">En attente (désactivé)</option>
              </Select>
            </Field>
          </FormGrid>
        )}
      </FormModal>

      <FormModal
        open={passwordFor !== null}
        onClose={() => setPasswordFor(null)}
        title="Changer le mot de passe"
        description={passwordFor ? `Compte de ${displayName(passwordFor)}` : undefined}
        size="sm"
        submitLabel="Changer le mot de passe"
        successMessage="Mot de passe modifié."
        initialValues={{ password: '' }}
        validate={validatePassword}
        onSubmit={({ password }) => setPassword.mutateAsync({ userId: passwordFor.id, password })}
      >
        {({ errors, bind }) => (
          <Field label="Nouveau mot de passe" htmlFor="mdp-nouveau" required error={errors.password} hint="Entre 8 et 72 caractères.">
            <Input {...bind('password')} type="password" autoComplete="new-password" />
          </Field>
        )}
      </FormModal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cet utilisateur ?"
        message={
          <>
            Le compte de <strong>{toDelete ? displayName(toDelete) : ''}</strong> sera supprimé définitivement. Ses ventes sont
            conservées, sans vendeur.
          </>
        }
        loading={deleteUser.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
