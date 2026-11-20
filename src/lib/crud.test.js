import { describe, expect, it } from 'vitest'
import { AppError } from './errors.js'
import { fetchAllRows, pick } from './crud.js'

// Imite une requête supabase-js : `.range(from, to)` renvoie { data, error }.
function fakeTable(total, calls, failAt = null) {
  const all = Array.from({ length: total }, (_, index) => ({ id: index + 1 }))
  return () => ({
    range: async (from, to) => {
      calls.push([from, to])
      if (failAt === from) return { data: null, error: { code: '42501', message: 'permission denied for table x' } }
      return { data: all.slice(from, to + 1), error: null }
    },
  })
}

describe('fetchAllRows', () => {
  it('enchaîne les blocs jusqu’au dernier, incomplet', async () => {
    const calls = []
    const rows = await fetchAllRows(fakeTable(25, calls), 10)
    expect(rows).toHaveLength(25)
    expect(rows.at(-1)).toEqual({ id: 25 })
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]])
  })
  it('fait une requête de plus quand le total tombe juste sur un bloc', async () => {
    const calls = []
    expect(await fetchAllRows(fakeTable(20, calls), 10)).toHaveLength(20)
    expect(calls).toHaveLength(3)
  })
  it('une seule requête pour une petite liste ou une liste vide', async () => {
    const calls = []
    expect(await fetchAllRows(fakeTable(3, calls), 10)).toHaveLength(3)
    expect(await fetchAllRows(fakeTable(0, calls), 10)).toEqual([])
    expect(calls).toHaveLength(2)
  })
  it('utilise des blocs de 1000 par défaut (limite de l’API)', async () => {
    const calls = []
    expect(await fetchAllRows(fakeTable(1500, calls))).toHaveLength(1500)
    expect(calls).toEqual([[0, 999], [1000, 1999]])
  })
  it('lève une AppError si un bloc échoue', async () => {
    await expect(fetchAllRows(fakeTable(25, [], 10), 10)).rejects.toBeInstanceOf(AppError)
  })
})

describe('pick', () => {
  it('ne garde que les colonnes autorisées et définies', () => {
    expect(pick({ id: 1, name: 'A', extra: true, phone: undefined }, ['name', 'phone'])).toEqual({ name: 'A' })
  })
})
