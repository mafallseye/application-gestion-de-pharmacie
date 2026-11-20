// Clients et fournisseurs partagent les mêmes colonnes.

export const EMPTY_CONTACT = { name: '', phone: '', fax: '', address: '', info: '' }

/** Colonnes DataTable communes. */
export const CONTACT_COLUMNS = [
  { key: 'name', header: 'Nom' },
  { key: 'phone', header: 'Téléphone', render: (row) => row.phone || '—' },
  { key: 'address', header: 'Adresse', render: (row) => row.address || '—' },
  { key: 'info', header: 'Remarques', render: (row) => row.info || '—' },
]
