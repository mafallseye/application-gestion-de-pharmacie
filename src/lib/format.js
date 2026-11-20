// Formatage pour l'affichage : français, franc CFA, fuseau de Dakar (UTC).

const LOCALE = 'fr-FR'
const TIME_ZONE = 'Africa/Dakar'
const EMPTY = '—'
const DAY_MS = 24 * 60 * 60 * 1000
export const EXPIRY_WARNING_DAYS = 90

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const moneyFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 1234.5 → « 1 234,5 » */
export function formatNumber(value) {
  const number = toNumber(value)
  return number === null ? EMPTY : numberFormat.format(number)
}

/** 12500 → « 12 500 FCFA » (arrondi au franc, espaces insécables). */
export function formatMoney(value) {
  const number = toNumber(value)
  return number === null ? EMPTY : `${moneyFormat.format(number)} FCFA`
}

/** '2027-03-01' ou horodatage ISO → « 01/03/2027 » */
export function formatDate(value) {
  const date = toDate(value)
  return date === null ? EMPTY : dateFormat.format(date)
}

/** Horodatage ISO → « 01/03/2027 14:05 » */
export function formatDateTime(value) {
  const date = toDate(value)
  return date === null ? EMPTY : dateTimeFormat.format(date).replace(',', '')
}

/** Date du jour à Dakar (= UTC) au format AAAA-MM-JJ. */
export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

// --- État d'un médicament (mêmes règles que la fonction SQL dashboard_stats) ---

/** Jours restants avant péremption (négatif si dépassée), ou null sans date. */
export function daysUntilExpiry(medicine, today = todayISO()) {
  if (!medicine?.expiry_date) return null
  return Math.round((Date.parse(medicine.expiry_date) - Date.parse(today)) / DAY_MS)
}

export function isExpired(medicine, today = todayISO()) {
  const days = daysUntilExpiry(medicine, today)
  return days !== null && days < 0
}

/** Pas encore périmé, mais périmé dans moins de 90 jours. */
export function isExpiringSoon(medicine, today = todayISO()) {
  const days = daysUntilExpiry(medicine, today)
  return days !== null && days >= 0 && days < EXPIRY_WARNING_DAYS
}

export function isOutOfStock(medicine) {
  return Number(medicine?.quantity) <= 0
}

/** Stock inférieur ou égal au seuil d'alerte (inclut la rupture). */
export function isLowStock(medicine) {
  return Number(medicine?.quantity) <= Number(medicine?.low_stock_threshold)
}

export function medicineStatus(medicine, today = todayISO()) {
  return {
    expired: isExpired(medicine, today),
    expiringSoon: isExpiringSoon(medicine, today),
    lowStock: isLowStock(medicine),
    outOfStock: isOutOfStock(medicine),
    daysUntilExpiry: daysUntilExpiry(medicine, today),
  }
}

/** Vendable : en stock et non périmé (create_sale refuse le reste). */
export function isSellable(medicine, today = todayISO()) {
  return !isOutOfStock(medicine) && !isExpired(medicine, today)
}
