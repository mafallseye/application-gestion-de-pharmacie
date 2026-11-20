import { describe, expect, it } from 'vitest'
import { filterMedicines } from './filters.js'

const today = '2026-11-20'
const medicines = [
  { id: 1, brand_name: 'Doliprane', generic_name: 'Paracétamol', category_id: 1, supplier_id: 1, quantity: 50, low_stock_threshold: 10, expiry_date: '2028-01-01', category: { id: 1, name: 'Antalgiques' }, supplier: { id: 1, name: 'Sodipharm' } },
  { id: 2, brand_name: 'Amoxil', generic_name: 'Amoxicilline', category_id: 2, supplier_id: null, quantity: 4, low_stock_threshold: 10, expiry_date: '2026-12-15', category: { id: 2, name: 'Antibiotiques' }, supplier: null },
  { id: 3, brand_name: 'Vieux sirop', generic_name: '', category_id: null, supplier_id: 1, quantity: 0, low_stock_threshold: 5, expiry_date: '2026-01-01', category: null, supplier: { id: 1, name: 'Sodipharm' } },
]
const ids = (filters) => filterMedicines(medicines, filters, today).map((medicine) => medicine.id)

describe('filterMedicines', () => {
  it('sans filtre, renvoie tout', () => {
    expect(ids()).toEqual([1, 2, 3])
    expect(filterMedicines(undefined)).toEqual([])
  })
  it('cherche dans les noms, la catégorie et le fournisseur, sans accents ni casse', () => {
    expect(ids({ search: 'paracetamol' })).toEqual([1])
    expect(ids({ search: 'ANTIBIO' })).toEqual([2])
    expect(ids({ search: 'sodipharm sirop' })).toEqual([3])
  })
  it('filtre par catégorie et fournisseur (valeurs de formulaire en chaînes)', () => {
    expect(ids({ categoryId: '2' })).toEqual([2])
    expect(ids({ supplierId: 1 })).toEqual([1, 3])
  })
  it("filtre par état", () => {
    expect(ids({ status: 'expired' })).toEqual([3])
    expect(ids({ status: 'expiring' })).toEqual([2])
    expect(ids({ status: 'low_stock' })).toEqual([2, 3])
    expect(ids({ status: 'out_of_stock' })).toEqual([3])
    expect(ids({ status: 'sellable' })).toEqual([1, 2])
  })
})
