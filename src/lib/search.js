// Recherche côté client : insensible à la casse et aux accents.

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Vrai si tous les mots de `query` apparaissent dans l'un des `fields` de l'élément. */
export function matchesSearch(item, query, fields) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = fields.map((field) => normalizeText(item?.[field])).join(' ')
  return words.every((word) => haystack.includes(word))
}

export function filterBySearch(items, query, fields) {
  return (items ?? []).filter((item) => matchesSearch(item, query, fields))
}
