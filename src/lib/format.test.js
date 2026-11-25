import { describe, expect, it } from 'vitest'
import {
  daysUntilExpiry,
  firstName,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  isExpired,
  isExpiringSoon,
  isLowStock,
  isSellable,
  medicineStatus,
  todayISO,
} from './format.js'

// Intl utilise des espaces insécables (fines ou non) : on les ramène à des espaces simples.
const plain = (text) => text.replace(/[  ]/g, ' ')

describe('formatMoney', () => {
  it('affiche des francs CFA sans décimales', () => {
    expect(plain(formatMoney(12500))).toBe('12 500 FCFA')
    expect(plain(formatMoney('1999.6'))).toBe('2 000 FCFA')
    expect(plain(formatMoney(0))).toBe('0 FCFA')
  })
  it('affiche un tiret pour une valeur absente ou invalide', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney('')).toBe('—')
    expect(formatMoney('abc')).toBe('—')
  })
  it('ne contient que des espaces insécables', () => {
    expect(formatMoney(1234567)).not.toContain(' ')
  })
})

describe('formatNumber', () => {
  it('utilise les conventions françaises', () => {
    expect(plain(formatNumber(1234567))).toBe('1 234 567')
    expect(formatNumber(2.5)).toBe('2,5')
    expect(formatNumber(undefined)).toBe('—')
  })
})

describe('formatDate / formatDateTime', () => {
  it('formate une date seule', () => {
    expect(formatDate('2027-03-01')).toBe('01/03/2027')
  })
  it("formate un horodatage à l'heure de Dakar (UTC)", () => {
    expect(formatDate('2026-12-31T23:30:00+00:00')).toBe('31/12/2026')
    expect(formatDateTime('2026-11-20T14:05:00+00:00')).toBe('20/11/2026 14:05')
    // 01:30 à Paris le 1er janvier = 00:30 à Dakar.
    expect(formatDateTime('2027-01-01T01:30:00+01:00')).toBe('01/01/2027 00:30')
  })
  it('affiche un tiret sans date valide', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime('pas une date')).toBe('—')
  })
})

describe('état des médicaments', () => {
  const today = '2026-11-20'
  const medicine = (overrides) => ({ quantity: 50, low_stock_threshold: 10, expiry_date: null, ...overrides })

  it('todayISO donne la date UTC', () => {
    expect(todayISO(new Date('2026-11-20T23:59:59Z'))).toBe('2026-11-20')
  })
  it('sans date de péremption : ni périmé ni bientôt périmé', () => {
    expect(daysUntilExpiry(medicine(), today)).toBeNull()
    expect(isExpired(medicine(), today)).toBe(false)
    expect(isExpiringSoon(medicine(), today)).toBe(false)
  })
  it('périmé seulement après la date de péremption', () => {
    expect(isExpired(medicine({ expiry_date: '2026-11-19' }), today)).toBe(true)
    expect(isExpired(medicine({ expiry_date: today }), today)).toBe(false)
  })
  it('bientôt périmé : de 0 à 89 jours', () => {
    expect(isExpiringSoon(medicine({ expiry_date: today }), today)).toBe(true)
    expect(isExpiringSoon(medicine({ expiry_date: '2027-02-17' }), today)).toBe(true) // 89 jours
    expect(isExpiringSoon(medicine({ expiry_date: '2027-02-18' }), today)).toBe(false) // 90 jours
    expect(isExpiringSoon(medicine({ expiry_date: '2026-11-19' }), today)).toBe(false)
  })
  it('stock bas : quantité inférieure ou égale au seuil', () => {
    expect(isLowStock(medicine({ quantity: 10 }))).toBe(true)
    expect(isLowStock(medicine({ quantity: 11 }))).toBe(false)
    expect(isLowStock(medicine({ quantity: 0, low_stock_threshold: 0 }))).toBe(true)
  })
  it('vendable : en stock et non périmé', () => {
    expect(isSellable(medicine(), today)).toBe(true)
    expect(isSellable(medicine({ quantity: 0 }), today)).toBe(false)
    expect(isSellable(medicine({ expiry_date: '2020-01-01' }), today)).toBe(false)
  })
  it('medicineStatus regroupe les indicateurs', () => {
    expect(medicineStatus(medicine({ quantity: 0, expiry_date: '2026-11-25' }), today)).toEqual({
      expired: false,
      expiringSoon: true,
      lowStock: true,
      outOfStock: true,
      daysUntilExpiry: 5,
    })
  })
})

describe('firstName', () => {
  it('prend le premier mot du nom', () => {
    expect(firstName('Awa Ndiaye')).toBe('Awa')
    expect(firstName('  Moussa  ')).toBe('Moussa')
  })
  it('ignore un titre en tête', () => {
    expect(firstName('Dr Aminata Sow')).toBe('Aminata')
    expect(firstName('Dr. Aminata Sow')).toBe('Aminata')
    expect(firstName('Mme Fatou Sarr')).toBe('Fatou')
  })
  it('garde un mot seul, même si c’est un titre, et accepte le vide', () => {
    expect(firstName('Dr')).toBe('Dr')
    expect(firstName('')).toBe('')
    expect(firstName(null)).toBe('')
  })
})
