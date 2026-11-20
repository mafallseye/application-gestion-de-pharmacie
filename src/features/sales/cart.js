// Panier de la caisse : fonctions pures, le panier n'est jamais modifié en place.
// Une ligne : { medicine_id, name, unit_price, quantity, stock }.
// Le prix affiché est indicatif : create_sale relit prix et stock en base.
import { isSellable, todayISO } from '../../lib/format.js'

function roundMoney(amount) {
  return Math.round(amount * 100) / 100
}

/** Quantité entière ramenée entre 1 et le stock. */
function clampQuantity(quantity, stock) {
  const wanted = Math.trunc(Number(quantity))
  if (!Number.isFinite(wanted)) return 1
  return Math.max(1, Math.min(wanted, stock))
}

/** Ajoute un médicament (ou augmente sa ligne). Sans effet s'il est périmé ou en rupture. */
export function addToCart(cart, medicine, quantity = 1, today = todayISO()) {
  if (!isSellable(medicine, today)) return cart
  const existing = cart.find((line) => line.medicine_id === medicine.id)
  const line = {
    medicine_id: medicine.id,
    name: medicine.brand_name,
    unit_price: Number(medicine.price),
    stock: medicine.quantity,
    quantity: clampQuantity((existing?.quantity ?? 0) + Number(quantity), medicine.quantity),
  }
  if (!existing) return [...cart, line]
  return cart.map((current) => (current === existing ? line : current))
}

/** Fixe la quantité d'une ligne, bornée entre 1 et le stock. */
export function setQuantity(cart, medicineId, quantity) {
  return cart.map((line) =>
    line.medicine_id === medicineId ? { ...line, quantity: clampQuantity(quantity, line.stock) } : line,
  )
}

export function removeFromCart(cart, medicineId) {
  return cart.filter((line) => line.medicine_id !== medicineId)
}

/**
 * Réaligne le panier sur la liste de médicaments fraîchement chargée : prix et
 * stock à jour, lignes devenues invendables retirées.
 */
export function syncCart(cart, medicines, today = todayISO()) {
  const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]))
  return cart.reduce((next, line) => {
    const medicine = byId.get(line.medicine_id)
    return medicine ? addToCart(next, medicine, line.quantity, today) : next
  }, [])
}

export function lineTotal(line) {
  return roundMoney(line.unit_price * line.quantity)
}

export function cartTotal(cart) {
  return roundMoney(cart.reduce((sum, line) => sum + line.unit_price * line.quantity, 0))
}

/** Nombre total d'unités dans le panier. */
export function cartCount(cart) {
  return cart.reduce((sum, line) => sum + line.quantity, 0)
}

/** Reste à payer : jamais négatif. */
export function balanceDue(total, paid) {
  const due = roundMoney(Number(total) - (Number(paid) || 0))
  return due > 0 ? due : 0
}

/** Format attendu par la RPC create_sale. */
export function toSaleItems(cart) {
  return cart.map((line) => ({ medicine_id: line.medicine_id, quantity: line.quantity }))
}
