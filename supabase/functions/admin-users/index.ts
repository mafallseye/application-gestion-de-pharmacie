// Gestion des comptes par un administrateur (création, mot de passe, suppression).
// Ces opérations exigent la clé de service : elles ne peuvent pas se faire
// depuis le navigateur, d'où cette fonction côté serveur.
//
// POST { action: 'create', email, password, full_name, role }
// POST { action: 'set_password', user_id, password }
// POST { action: 'delete', user_id }
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['admin', 'pharmacien', 'caissier']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const validPassword = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 8 && v.length <= 72

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Qui appelle ? Le jeton est vérifié auprès du service d'authentification.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Connexion requise.' })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) return json(401, { error: 'Session invalide.' })
  const callerId = userData.user.id

  // 2. Est-ce un administrateur actif, rattaché à une pharmacie ?
  const { data: caller } = await admin
    .from('profiles')
    .select('role, active, pharmacy_id')
    .eq('id', callerId)
    .maybeSingle()
  if (!caller || !caller.active || caller.role !== 'admin' || !caller.pharmacy_id) {
    return json(403, { error: 'Réservé aux administrateurs.' })
  }
  const pharmacyId: string = caller.pharmacy_id

  // Un administrateur n'agit que sur les comptes de sa propre pharmacie.
  const inMyPharmacy = async (userId: string) => {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle()
    return Boolean(data)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Requête invalide.' })
  }

  if (body.action === 'create') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 120) : ''
    const role = body.role
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return json(400, { error: "L'adresse e-mail n'est pas valide." })
    }
    if (!validPassword(body.password)) {
      return json(400, { error: 'Le mot de passe doit contenir entre 8 et 72 caractères.' })
    }
    if (typeof role !== 'string' || !ROLES.includes(role)) {
      return json(400, { error: 'Rôle invalide.' })
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !created?.user) {
      const exists = /already|registered|exists/i.test(error?.message ?? '')
      return json(exists ? 409 : 400, {
        error: exists ? 'Cette adresse e-mail est déjà utilisée.' : 'Création du compte impossible.',
      })
    }

    // Le profil est créé (inactif) par un déclencheur ; on l'active avec son rôle.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ role, active: true, full_name: fullName, pharmacy_id: pharmacyId })
      .eq('id', created.user.id)
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json(500, { error: 'Création du compte impossible.' })
    }
    return json(200, { id: created.user.id })
  }

  if (body.action === 'set_password') {
    if (!isUuid(body.user_id)) return json(400, { error: 'Utilisateur invalide.' })
    if (!validPassword(body.password)) {
      return json(400, { error: 'Le mot de passe doit contenir entre 8 et 72 caractères.' })
    }
    if (!(await inMyPharmacy(body.user_id))) return json(404, { error: 'Utilisateur introuvable.' })
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password })
    if (error) return json(400, { error: 'Changement de mot de passe impossible.' })
    return json(200, { ok: true })
  }

  if (body.action === 'delete') {
    if (!isUuid(body.user_id)) return json(400, { error: 'Utilisateur invalide.' })
    if (body.user_id === callerId) {
      return json(400, { error: 'Vous ne pouvez pas supprimer votre propre compte.' })
    }
    if (!(await inMyPharmacy(body.user_id))) return json(404, { error: 'Utilisateur introuvable.' })
    const { error } = await admin.auth.admin.deleteUser(body.user_id)
    if (error) return json(400, { error: 'Suppression impossible.' })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Action inconnue.' })
})
