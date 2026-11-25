import { describe, expect, it } from 'vitest'
import {
  addToCart,
  balanceDue,
  cartCount,
  cartTotal,
  lineTotal,
  removeFromCart,
  setQuantity,
  syncCart,
  toSaleItems,
} from './cart.js'
import { filterSales, paymentStatus, saleBalance } from './filters.js'

const today = '2026-11-20'
const doliprane = { id: 1, brand_name: 'Doliprane', price: 1500, quantity: 5, expiry_date: '2028-01-01' }
const sirop = { id: 2, brand_name: 'Sirop', price: 2250.5, quantity: 2, expiry_date: null }
const add = (cart, medicine, quantity) => addToCart(cart, medicine, quantity, today)

describe('addToCart', () => {
  it('ajoute une ligne sans modifier le panier initial', () => {
    const empty = []
    const cart = add(empty, doliprane)
    expect(empty).toEqual([])
    expect(cart).toEqual([{ medicine_id: 1, name: 'Doliprane', unit_price: 1500, stock: 5, quantity: 1 }])
  })
  it('cumule les quantités sans dépasser le stock', () => {
    let cart = add([], doliprane, 3)
    cart = add(cart, doliprane, 1)
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(4)
    expect(add(cart, doliprane, 10)[0].quantity).toBe(5)
  })
  it('refuse un médicament en rupture ou périmé', () => {
    const cart = add([], doliprane)
    expect(add(cart, { ...sirop, quantity: 0 })).toBe(cart)
    expect(add(cart, { ...sirop, expiry_date: '2026-11-19' })).toBe(cart)
  })
})

describe('setQuantity / removeFromCart', () => {
  const cart = add(add([], doliprane), sirop)

  it('borne la quantité entre 1 et le stock', () => {
    expect(setQuantity(cart, 1, 3)[0].quantity).toBe(3)
    expect(setQuantity(cart, 1, 99)[0].quantity).toBe(5)
    expect(setQuantity(cart, 1, 0)[0].quantity).toBe(1)
    expect(setQuantity(cart, 1, -4)[0].quantity).toBe(1)
    expect(setQuantity(cart, 1, 'abc')[0].quantity).toBe(1)
    expect(setQuantity(cart, 1, '2.9')[0].quantity).toBe(2)
  })
  it('ne touche ni aux autres lignes ni au panier initial', () => {
    const next = setQuantity(cart, 1, 3)
    expect(next[1]).toBe(cart[1])
    expect(cart[0].quantity).toBe(1)
    expect(setQuantity(cart, 999, 3)).toEqual(cart)
  })
  it('retire une ligne', () => {
    expect(removeFromCart(cart, 1).map((line) => line.medicine_id)).toEqual([2])
  })
})

describe('totaux', () => {
  const cart = setQuantity(add(add([], doliprane), sirop), 1, 3)

  it('calcule lignes, total et nombre', () => {
    expect(lineTotal(cart[0])).toBe(4500)
    expect(cartTotal(cart)).toBe(6750.5)
    expect(cartCount(cart)).toBe(4)
    expect(cartTotal([])).toBe(0)
  })
  it("n'accumule pas d'erreurs d'arrondi", () => {
    const line = { medicine_id: 9, name: 'x', unit_price: 0.1, quantity: 3, stock: 9 }
    expect(cartTotal([line])).toBe(0.3)
  })
  it('calcule le reste à payer, jamais négatif', () => {
    expect(balanceDue(6750, 5000)).toBe(1750)
    expect(balanceDue(6750, 6750)).toBe(0)
    expect(balanceDue(6750, 9000)).toBe(0)
    expect(balanceDue(6750, '')).toBe(6750)
  })
  it('prépare les articles pour create_sale', () => {
    expect(toSaleItems(cart)).toEqual([
      { medicine_id: 1, quantity: 3 },
      { medicine_id: 2, quantity: 1 },
    ])
  })
})

describe('syncCart', () => {
  it('met à jour prix et stock, retire les lignes invendables', () => {
    const cart = setQuantity(add(add([], doliprane), sirop), 1, 5)
    const fresh = [{ ...doliprane, price: 1600, quantity: 2 }, { ...sirop, quantity: 0 }]
    expect(syncCart(cart, fresh, today)).toEqual([
      { medicine_id: 1, name: 'Doliprane', unit_price: 1600, stock: 2, quantity: 2 },
    ])
    expect(syncCart(cart, [], today)).toEqual([])
  })
})

describe('ventes : solde et filtres', () => {
  const sales = [
    { id: 1, number: 41, customer_name: 'Awa Ndiaye', grand_total: 5000, paid_amount: 5000, sold_at: '2026-11-18T10:00:00+00:00' },
    { id: 2, number: 42, customer_name: '', grand_total: 3000, paid_amount: 1000, sold_at: '2026-11-19T23:30:00+00:00' },
    { id: 3, number: 43, customer_name: 'Élodie Sarr', grand_total: 800, paid_amount: 0, sold_at: '2026-11-20T08:00:00+00:00' },
  ]
  const ids = (list) => list.map((sale) => sale.id)

  it('calcule le solde et le statut de paiement', () => {
    expect(sales.map(saleBalance)).toEqual([0, 2000, 800])
    expect(sales.map(paymentStatus)).toEqual(['paid', 'partial', 'unpaid'])
  })
  it('une vente en attente de paiement mobile n’est pas un impayé', () => {
    const awaiting = { id: 4, number: 44, customer_name: '', grand_total: 2000, paid_amount: 0, awaiting_mobile: true, sold_at: '2026-11-20T09:00:00+00:00' }
    expect(paymentStatus(awaiting)).toBe('awaiting_mobile')
    expect(ids(filterSales([...sales, awaiting], { unpaidOnly: true }))).toEqual([2, 3])
  })
  it('filtre par recherche (sans accents), impayés et période', () => {
    expect(ids(filterSales(sales))).toEqual([1, 2, 3])
    expect(ids(filterSales(sales, { search: 'elodie' }))).toEqual([3])
    // La recherche porte sur le numéro de vente affiché, pas sur l'identifiant technique.
    expect(ids(filterSales(sales, { search: '42' }))).toEqual([2])
    expect(ids(filterSales(sales, { search: '2' }))).toEqual([2])
    expect(ids(filterSales(sales, { unpaidOnly: true }))).toEqual([2, 3])
    expect(ids(filterSales(sales, { from: '2026-11-19', to: '2026-11-19' }))).toEqual([2])
  })
})
