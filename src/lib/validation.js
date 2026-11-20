// Validateurs purs : formulaire (chaînes saisies) → { values, errors }.
// `values` est normalisé et prêt à être envoyé ; `errors` contient un message
// français par champ invalide. Les limites reprennent les CHECK du schéma SQL.

export const ROLES = ['admin', 'pharmacien', 'caissier']
export const ROLE_LABELS = { admin: 'Administrateur', pharmacien: 'Pharmacien', caissier: 'Caissier' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INT4_MAX = 2_147_483_647
const PRICE_MAX = 9_999_999_999 // numeric(12, 2)

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}

function text(value) {
  return String(value ?? '').trim()
}

/** Entier positif ou nul saisi au clavier (« 12 500 » accepté), sinon NaN ; vide → null. */
function parseInteger(value) {
  const raw = String(value ?? '').replace(/[\s  ]/g, '')
  if (raw === '') return null
  return /^\d+$/.test(raw) ? Number(raw) : NaN
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Petits contrôles réutilisés : chacun renvoie la valeur normalisée et note l'erreur éventuelle.

function requiredText(errors, field, value, max, label) {
  const result = text(value)
  if (result === '') errors[field] = `${label} est obligatoire.`
  else if (result.length > max) errors[field] = `${label} ne doit pas dépasser ${max} caractères.`
  return result
}

function optionalText(errors, field, value, max, label) {
  const result = text(value)
  if (result.length > max) errors[field] = `${label} ne doit pas dépasser ${max} caractères.`
  return result
}

function integer(errors, field, value, { label, max = INT4_MAX, fallback = null }) {
  const result = parseInteger(value)
  if (result === null) {
    if (fallback === null) errors[field] = `${label} est obligatoire.`
    return fallback
  }
  if (Number.isNaN(result)) {
    errors[field] = `${label} doit être un nombre entier positif ou nul.`
    return null
  }
  if (result > max) {
    errors[field] = `${label} est trop élevé.`
    return null
  }
  return result
}

/** Identifiant de liste déroulante : '' → null. */
function optionalId(errors, field, value, label) {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    errors[field] = `${label} n'est pas valide.`
    return null
  }
  return id
}

export function validateMedicine(input = {}) {
  const errors = {}
  const values = {
    brand_name: requiredText(errors, 'brand_name', input.brand_name, 160, 'Le nom commercial'),
    generic_name: optionalText(errors, 'generic_name', input.generic_name, 160, 'Le nom générique'),
    category_id: optionalId(errors, 'category_id', input.category_id, 'La catégorie'),
    supplier_id: optionalId(errors, 'supplier_id', input.supplier_id, 'Le fournisseur'),
    // Le franc CFA n'a pas de centimes : les prix sont saisis en francs entiers.
    price: integer(errors, 'price', input.price, { label: 'Le prix', max: PRICE_MAX }),
    quantity: integer(errors, 'quantity', input.quantity, { label: 'La quantité' }),
    low_stock_threshold: integer(errors, 'low_stock_threshold', input.low_stock_threshold, {
      label: "Le seuil d'alerte",
      fallback: 10,
    }),
    expiry_date: null,
  }
  const expiry = text(input.expiry_date)
  if (expiry !== '') {
    if (isRealDate(expiry)) values.expiry_date = expiry
    else errors.expiry_date = "La date de péremption n'est pas valide."
  }
  return { values, errors }
}

export function validateCategory(input = {}) {
  const errors = {}
  const values = {
    name: requiredText(errors, 'name', input.name, 120, 'Le nom'),
    short_name: optionalText(errors, 'short_name', input.short_name, 30, "L'abréviation"),
  }
  return { values, errors }
}

// Clients et fournisseurs ont les mêmes colonnes.
function validateContact(input = {}) {
  const errors = {}
  const values = {
    name: requiredText(errors, 'name', input.name, 160, 'Le nom'),
    address: optionalText(errors, 'address', input.address, 255, "L'adresse"),
    phone: optionalText(errors, 'phone', input.phone, 40, 'Le téléphone'),
    fax: optionalText(errors, 'fax', input.fax, 40, 'Le fax'),
    info: optionalText(errors, 'info', input.info, 1000, 'La note'),
  }
  return { values, errors }
}

export const validateCustomer = validateContact
export const validateSupplier = validateContact

function password(errors, value) {
  // Pas de trim : les espaces font partie du mot de passe.
  const result = String(value ?? '')
  if (result === '') errors.password = 'Le mot de passe est obligatoire.'
  else if (result.length < 8 || result.length > 72) {
    errors.password = 'Le mot de passe doit contenir entre 8 et 72 caractères.'
  }
  return result
}

function email(errors, value) {
  const result = text(value).toLowerCase()
  if (result === '') errors.email = "L'adresse e-mail est obligatoire."
  else if (!EMAIL_PATTERN.test(result) || result.length > 255) {
    errors.email = "L'adresse e-mail n'est pas valide."
  }
  return result
}

/**
 * Utilisateur. mode 'create' : e-mail, mot de passe, nom, rôle.
 * mode 'update' : nom, rôle, compte actif (l'e-mail ne se modifie pas).
 */
export function validateUser(input = {}, { mode = 'create' } = {}) {
  const errors = {}
  const values = {
    full_name: requiredText(errors, 'full_name', input.full_name, 120, 'Le nom complet'),
    role: input.role,
  }
  if (!ROLES.includes(values.role)) errors.role = 'Choisissez un rôle.'
  if (mode === 'create') {
    values.email = email(errors, input.email)
    values.password = password(errors, input.password)
  } else {
    values.active = input.active === true || input.active === 'true'
  }
  return { values, errors }
}

/** Changement de mot de passe d'un utilisateur par un administrateur. */
export function validatePassword(input = {}) {
  const errors = {}
  const values = { password: password(errors, input.password) }
  return { values, errors }
}

/** Changement de son propre mot de passe : nouveau mot de passe + confirmation. */
export function validatePasswordChange(input = {}) {
  const errors = {}
  const values = { password: password(errors, input.password) }
  if (!errors.password && String(input.confirmation ?? '') !== values.password) {
    errors.confirmation = 'Les deux mots de passe ne sont pas identiques.'
  }
  return { values, errors }
}

/** Inscription d'un nouvel administrateur : nom, e-mail, mot de passe + confirmation. */
export function validateSignup(input = {}) {
  const errors = {}
  const values = {
    full_name: requiredText(errors, 'full_name', input.full_name, 120, 'Le nom complet'),
    email: email(errors, input.email),
    password: password(errors, input.password),
  }
  if (!errors.password && String(input.confirmation ?? '') !== values.password) {
    errors.confirmation = 'Les deux mots de passe ne sont pas identiques.'
  }
  return { values, errors }
}

/** Fiche d'une pharmacie (nom, téléphone, adresse). */
export function validatePharmacy(input = {}) {
  const errors = {}
  const values = {
    name: requiredText(errors, 'name', input.name, 160, 'Le nom de la pharmacie'),
    phone: optionalText(errors, 'phone', input.phone, 40, 'Le téléphone'),
    address: optionalText(errors, 'address', input.address, 255, "L'adresse"),
  }
  return { values, errors }
}

/** Création de la pharmacie par son futur administrateur : fiche + son nom complet. */
export function validatePharmacyRegistration(input = {}) {
  const { values, errors } = validatePharmacy(input)
  values.full_name = requiredText(errors, 'full_name', input.full_name, 120, 'Votre nom complet')
  return { values, errors }
}

/** Formulaire de connexion (aucune règle de longueur : on ne décrit pas les mots de passe valides). */
export function validateLogin(input = {}) {
  const errors = {}
  const values = { email: email(errors, input.email), password: String(input.password ?? '') }
  if (values.password === '') errors.password = 'Le mot de passe est obligatoire.'
  return { values, errors }
}

/**
 * Montant encaissé, en francs entiers, plafonné par `max` (reste à payer ou
 * total de la vente). `allowZero` : vrai à la caisse (vente à crédit), faux
 * pour un encaissement ultérieur.
 */
export function validatePayment(input = {}, { max, allowZero = false } = {}) {
  const errors = {}
  const amount = integer(errors, 'amount', input.amount, { label: 'Le montant', max: PRICE_MAX })
  if (!errors.amount) {
    if (amount === 0 && !allowZero) errors.amount = 'Le montant doit être supérieur à zéro.'
    else if (max !== undefined && amount > Number(max)) {
      errors.amount = 'Le montant dépasse le reste à payer.'
    }
  }
  return { values: { amount }, errors }
}
