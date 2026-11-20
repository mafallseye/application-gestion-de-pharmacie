// Écritures génériques sur une table, partagées par les fichiers api.js.
import { AppError, NO_ROW, unwrap } from './errors.js'
import { supabase } from './supabase.js'

/** Ne garde que les colonnes autorisées (ignore id, jointures, created_at…). */
export function pick(source, columns) {
  return Object.fromEntries(columns.filter((c) => source[c] !== undefined).map((c) => [c, source[c]]))
}

export const PAGE_SIZE = 1000

/**
 * Charge toutes les lignes d'une liste, par blocs : l'API Supabase ne renvoie
 * pas plus de 1000 lignes par requête. `buildQuery()` doit renvoyer une requête
 * neuve à chaque appel, avec un ordre stable (terminer par l'id).
 */
export async function fetchAllRows(buildQuery, pageSize = PAGE_SIZE) {
  const rows = []
  for (;;) {
    const page = unwrap(await buildQuery().range(rows.length, rows.length + pageSize - 1))
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/**
 * Crée la ligne (sans `id`) ou la met à jour (avec `id`) et renvoie la ligne enregistrée.
 * `.single()` signale une mise à jour qui n'a touché aucune ligne : les règles
 * d'accès (RLS) filtrent en silence au lieu de renvoyer une erreur.
 */
export async function saveRow(table, id, fields, overrides) {
  const query = id == null ? supabase.from(table).insert(fields) : supabase.from(table).update(fields).eq('id', id)
  return unwrap(await query.select().single(), overrides)
}

/** Supprime une ligne ; lève une erreur si rien n'a été supprimé (introuvable ou droits). */
export async function deleteRow(table, id) {
  const rows = unwrap(await supabase.from(table).delete().eq('id', id).select('id'))
  if (rows.length === 0) throw new AppError(NO_ROW)
}
