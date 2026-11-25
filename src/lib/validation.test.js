import { describe, expect, it } from 'vitest'
import {
  hasErrors,
  validateCategory,
  validateCustomer,
  validateEmailAddress,
  validateFeedback,
  validateLogin,
  validateMobileMoneyKeys,
  validateMedicine,
  validatePassword,
  validatePasswordChange,
  validatePharmacy,
  validatePharmacyRegistration,
  validateSignup,
  validatePayment,
  validateSupplier,
  validateUser,
} from './validation.js'

describe('validateMedicine', () => {
  const valid = {
    brand_name: '  Doliprane 1000  ',
    generic_name: ' Paracétamol ',
    category_id: '3',
    supplier_id: '',
    price: '1 500',
    quantity: '40',
    low_stock_threshold: '',
    expiry_date: '2027-06-30',
  }

  it('normalise une saisie valide', () => {
    const { values, errors } = validateMedicine(valid)
    expect(errors).toEqual({})
    expect(hasErrors(errors)).toBe(false)
    expect(values).toEqual({
      brand_name: 'Doliprane 1000',
      generic_name: 'Paracétamol',
      category_id: 3,
      supplier_id: null,
      price: 1500,
      quantity: 40,
      low_stock_threshold: 10,
      expiry_date: '2027-06-30',
    })
  })
  it('accepte une date de péremption vide et un stock nul', () => {
    const { values, errors } = validateMedicine({ ...valid, expiry_date: '', quantity: 0, price: 0 })
    expect(errors).toEqual({})
    expect(values.expiry_date).toBeNull()
    expect(values.quantity).toBe(0)
  })
  it('signale chaque champ invalide en français', () => {
    const { errors } = validateMedicine({
      brand_name: '   ',
      generic_name: 'x'.repeat(161),
      category_id: 'abc',
      price: '-5',
      quantity: '2,5',
      low_stock_threshold: 'dix',
      expiry_date: '2027-02-30',
    })
    expect(Object.keys(errors).sort()).toEqual([
      'brand_name',
      'category_id',
      'expiry_date',
      'generic_name',
      'low_stock_threshold',
      'price',
      'quantity',
    ])
    expect(errors.brand_name).toBe('Le nom commercial est obligatoire.')
    expect(errors.price).toBe('Le prix doit être un nombre entier positif ou nul.')
  })
  it('exige prix et quantité', () => {
    const { errors } = validateMedicine({ brand_name: 'A' })
    expect(errors.price).toBe('Le prix est obligatoire.')
    expect(errors.quantity).toBe('La quantité est obligatoire.')
  })
  it('refuse les nombres hors limites', () => {
    const { errors } = validateMedicine({ ...valid, quantity: '3000000000', price: '99999999999' })
    expect(errors.quantity).toMatch(/trop élevé/)
    expect(errors.price).toMatch(/trop élevé/)
  })
})

describe('validateCategory', () => {
  it('normalise et contrôle les longueurs', () => {
    expect(validateCategory({ name: ' Antibiotiques ', short_name: ' ATB ' })).toEqual({
      values: { name: 'Antibiotiques', short_name: 'ATB' },
      errors: {},
    })
    const { errors } = validateCategory({ name: 'x'.repeat(121), short_name: 'y'.repeat(31) })
    expect(errors.name).toMatch(/120 caractères/)
    expect(errors.short_name).toMatch(/30 caractères/)
    expect(validateCategory({}).errors.name).toBe('Le nom est obligatoire.')
  })
})

describe('validateCustomer / validateSupplier', () => {
  it('normalise les champs facultatifs en chaînes vides', () => {
    const { values, errors } = validateCustomer({ name: ' Awa Ndiaye ', phone: ' 77 123 45 67 ' })
    expect(errors).toEqual({})
    expect(values).toEqual({ name: 'Awa Ndiaye', address: '', phone: '77 123 45 67', fax: '', info: '' })
  })
  it('contrôle les longueurs du schéma', () => {
    const { errors } = validateSupplier({
      name: '',
      address: 'a'.repeat(256),
      phone: '1'.repeat(41),
      fax: '1'.repeat(41),
      info: 'i'.repeat(1001),
    })
    expect(Object.keys(errors).sort()).toEqual(['address', 'fax', 'info', 'name', 'phone'])
  })
})

describe('validateUser', () => {
  it('création : normalise e-mail et nom, garde le mot de passe intact', () => {
    const { values, errors } = validateUser({
      email: ' Fatou@Exemple.SN ',
      password: ' motdepasse ',
      full_name: ' Fatou Sow ',
      role: 'caissier',
    })
    expect(errors).toEqual({})
    expect(values).toEqual({
      email: 'fatou@exemple.sn',
      password: ' motdepasse ',
      full_name: 'Fatou Sow',
      role: 'caissier',
    })
  })
  it('création : signale les champs invalides', () => {
    const { errors } = validateUser({ email: 'pas-un-email', password: 'court', full_name: '', role: 'chef' })
    expect(errors.email).toBe("L'adresse e-mail n'est pas valide.")
    expect(errors.password).toBe('Le mot de passe doit contenir entre 8 et 72 caractères.')
    expect(errors.full_name).toBeDefined()
    expect(errors.role).toBe('Choisissez un rôle.')
  })
  it('modification : ni e-mail ni mot de passe, mais le statut actif', () => {
    const { values, errors } = validateUser({ full_name: 'Fatou Sow', role: 'admin', active: false }, { mode: 'update' })
    expect(errors).toEqual({})
    expect(values).toEqual({ full_name: 'Fatou Sow', role: 'admin', active: false })
  })
})

describe('validatePassword / validateLogin', () => {
  it('borne la longueur du mot de passe', () => {
    expect(validatePassword({ password: '12345678' }).errors).toEqual({})
    expect(validatePassword({ password: 'x'.repeat(73) }).errors.password).toBeDefined()
    expect(validatePassword({}).errors.password).toBe('Le mot de passe est obligatoire.')
  })
  it('connexion : e-mail valide et mot de passe non vide', () => {
    expect(validateLogin({ email: 'a@b.sn', password: 'x' }).errors).toEqual({})
    expect(Object.keys(validateLogin({}).errors).sort()).toEqual(['email', 'password'])
  })
})

describe('validatePayment', () => {
  it('accepte un montant entier dans la limite', () => {
    expect(validatePayment({ amount: '2 500' }, { max: 2500 })).toEqual({ values: { amount: 2500 }, errors: {} })
  })
  it('refuse zéro, sauf à la caisse', () => {
    expect(validatePayment({ amount: '0' }, { max: 100 }).errors.amount).toMatch(/supérieur à zéro/)
    expect(validatePayment({ amount: '0' }, { max: 100, allowZero: true }).errors).toEqual({})
  })
  it('refuse un montant trop élevé, vide ou non entier', () => {
    expect(validatePayment({ amount: '101' }, { max: 100 }).errors.amount).toMatch(/dépasse/)
    expect(validatePayment({ amount: '' }, { max: 100 }).errors.amount).toMatch(/obligatoire/)
    expect(validatePayment({ amount: '12.5' }, { max: 100 }).errors.amount).toMatch(/entier/)
  })
})

describe('validatePasswordChange', () => {
  it('accepte deux saisies identiques de 8 à 72 caractères', () => {
    expect(validatePasswordChange({ password: 'nouveau-secret', confirmation: 'nouveau-secret' })).toEqual({
      values: { password: 'nouveau-secret' },
      errors: {},
    })
  })
  it('refuse une confirmation différente', () => {
    const { errors } = validatePasswordChange({ password: 'nouveau-secret', confirmation: 'nouveau-secrex' })
    expect(errors).toEqual({ confirmation: 'Les deux mots de passe ne sont pas identiques.' })
  })
  it('signale d’abord un mot de passe trop court ou absent', () => {
    expect(validatePasswordChange({ password: 'court', confirmation: 'court' }).errors).toEqual({
      password: 'Le mot de passe doit contenir entre 8 et 72 caractères.',
    })
    expect(validatePasswordChange({}).errors.password).toBe('Le mot de passe est obligatoire.')
  })
})

describe('validateSignup', () => {
  const valid = { full_name: ' Awa Ndiaye ', email: ' Awa@Exemple.SN ', password: 'motdepasse', confirmation: 'motdepasse' }
  it('normalise une inscription valide (sans la confirmation)', () => {
    expect(validateSignup(valid)).toEqual({
      values: { full_name: 'Awa Ndiaye', email: 'awa@exemple.sn', password: 'motdepasse' },
      errors: {},
    })
  })
  it('signale nom, e-mail, mot de passe et confirmation', () => {
    expect(Object.keys(validateSignup({}).errors).sort()).toEqual(['email', 'full_name', 'password'])
    expect(validateSignup({ ...valid, confirmation: 'autre' }).errors).toEqual({
      confirmation: 'Les deux mots de passe ne sont pas identiques.',
    })
  })
})

describe('validatePharmacy / validatePharmacyRegistration', () => {
  it('normalise la fiche', () => {
    expect(validatePharmacy({ name: ' Pharmacie du Plateau ', phone: ' 33 821 00 00 ' })).toEqual({
      values: { name: 'Pharmacie du Plateau', phone: '33 821 00 00', address: '' },
      errors: {},
    })
  })
  it('contrôle les longueurs du schéma', () => {
    const { errors } = validatePharmacy({ name: '', phone: '1'.repeat(41), address: 'a'.repeat(256) })
    expect(Object.keys(errors).sort()).toEqual(['address', 'name', 'phone'])
    expect(errors.name).toBe('Le nom de la pharmacie est obligatoire.')
  })
  it('la création exige aussi le nom complet', () => {
    expect(validatePharmacyRegistration({ name: 'A' }).errors).toEqual({ full_name: 'Votre nom complet est obligatoire.' })
    expect(validatePharmacyRegistration({ name: 'A', full_name: ' Awa ' }).values).toEqual({
      name: 'A',
      phone: '',
      address: '',
      full_name: 'Awa',
    })
  })
})

describe('validateMobileMoneyKeys', () => {
  it('clé d’API obligatoire, clé du webhook facultative', () => {
    expect(validateMobileMoneyKeys({ api_key: '  naboo_cle_12345  ' })).toEqual({
      values: { api_key: 'naboo_cle_12345', webhook_secret: '' },
      errors: {},
    })
    expect(validateMobileMoneyKeys({}).errors).toEqual({ api_key: "La clé d'API est obligatoire." })
  })
  it('contrôle les longueurs (8 à 500 caractères)', () => {
    const { errors } = validateMobileMoneyKeys({ api_key: 'court', webhook_secret: 'x'.repeat(501) })
    expect(Object.keys(errors).sort()).toEqual(['api_key', 'webhook_secret'])
  })
})

describe('validateFeedback', () => {
  it('normalise un avis complet', () => {
    expect(validateFeedback({ rating: '4', message: '  Très pratique à la caisse.  ', missing: ' Un export Excel ' })).toEqual({
      values: { rating: 4, message: 'Très pratique à la caisse.', missing: 'Un export Excel' },
      errors: {},
    })
  })
  it('la note seule suffit', () => {
    expect(validateFeedback({ rating: 5 })).toEqual({ values: { rating: 5, message: '', missing: '' }, errors: {} })
  })
  it('refuse une note absente ou hors de 1 à 5', () => {
    for (const rating of ['', undefined, '0', '6', '2.5', 'abc']) {
      expect(validateFeedback({ rating }).errors.rating).toBe('Choisissez une note de 1 à 5 étoiles.')
    }
  })
  it('limite les textes à 2000 caractères', () => {
    const { errors } = validateFeedback({ rating: '3', message: 'a'.repeat(2001), missing: 'b'.repeat(2001) })
    expect(Object.keys(errors).sort()).toEqual(['message', 'missing'])
  })
})

describe('validateEmailAddress', () => {
  it('normalise une adresse valide', () => {
    expect(validateEmailAddress({ email: ' Awa@Exemple.SN ' })).toEqual({ values: { email: 'awa@exemple.sn' }, errors: {} })
  })
  it('refuse une adresse vide ou mal formée', () => {
    expect(validateEmailAddress({}).errors.email).toBe("L'adresse e-mail est obligatoire.")
    expect(validateEmailAddress({ email: 'awa@exemple' }).errors.email).toBe("L'adresse e-mail n'est pas valide.")
  })
})
