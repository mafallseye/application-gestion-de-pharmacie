// Abonnement d'une pharmacie, payé par PayDunya (paiement avec redirection).
//
// Appels de l'application (administrateur de la pharmacie, jeton Bearer) :
//   POST { action: 'checkout', plan }   -> { url } : page de paiement PayDunya
//   POST { action: 'verify', token }    -> { status } : vérifie un paiement
//        (completed, pending, cancelled, failed, review, error, unknown)
// Notification de PayDunya (IPN, sans jeton, formulaire) :
//   POST data[hash], data[invoice][token], ...
//
// Règle de sécurité : on ne croit jamais ce qui arrive du navigateur ou de la
// notification. Un paiement n'est validé qu'après avoir redemandé son état à
// PayDunya avec nos clés (serveur à serveur), et vérifié montant et référence.
//
// Secrets attendus (Edge Functions > Secrets) :
//   PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN,
//   PAYDUNYA_MODE ('test' par défaut, ou 'live'), APP_URL (adresse du site).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

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

type PayDunyaConfig = {
  base: string
  headers: Record<string, string>
  masterKey: string
  mode: 'test' | 'live'
}

function payDunyaConfig(): PayDunyaConfig | null {
  const masterKey = Deno.env.get('PAYDUNYA_MASTER_KEY')
  const privateKey = Deno.env.get('PAYDUNYA_PRIVATE_KEY')
  const token = Deno.env.get('PAYDUNYA_TOKEN')
  if (!masterKey || !privateKey || !token) return null
  const live = Deno.env.get('PAYDUNYA_MODE') === 'live'
  return {
    base: live ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1',
    masterKey,
    mode: live ? 'live' : 'test',
    headers: {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN': token,
    },
  }
}

async function sha512Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparaison en temps constant.
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Appel à PayDunya : une coupure réseau ou une réponse illisible donne null.
async function payDunya(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
    const data = await res.json()
    return res.ok && data && typeof data === 'object' ? data : null
  } catch (error) {
    console.error('billing: PayDunya injoignable', String(error))
    return null
  }
}

const validToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(v)

/**
 * Redemande à PayDunya l'état de la facture et met notre paiement à jour.
 * Renvoie :
 *   'completed' | 'cancelled' | 'failed'  état définitif
 *   'review'    argent reçu mais montant ou référence incohérents : à vérifier à la main
 *   'pending'   pas encore payé
 *   'error'     vérification impossible pour l'instant (à retenter)
 *   'unknown'   jeton inconnu
 */
async function syncPayment(admin: SupabaseClient, cfg: PayDunyaConfig, token: string) {
  const { data: payment, error: readError } = await admin
    .from('subscription_payments')
    .select('id, amount, status')
    .eq('provider_token', token)
    .maybeSingle()
  if (readError) return 'error'
  if (!payment) return 'unknown'
  if (payment.status !== 'pending') return payment.status as string

  const info = await payDunya(`${cfg.base}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: cfg.headers,
  })
  if (!info || info.response_code !== '00') return 'error'

  const status = String(info.status ?? '')
  if (status === 'completed') {
    const paid = Number(info.invoice?.total_amount)
    const reference = String(info.custom_data?.payment_id ?? '')
    const coherent =
      paid === Number(payment.amount) &&
      reference === String(payment.id) &&
      info.invoice?.token === token &&
      info.mode === cfg.mode
    if (!coherent) {
      console.error('billing: paiement reçu mais incohérent, à vérifier', {
        token,
        paid,
        expected: Number(payment.amount),
        reference,
        mode: info.mode,
      })
      await admin
        .from('subscription_payments')
        .update({ status: 'review' })
        .eq('id', payment.id)
        .eq('status', 'pending')
      return 'review'
    }
    const { error } = await admin.rpc('complete_subscription_payment', { p_token: token })
    if (error) {
      console.error('billing: validation impossible', error.message)
      return 'error'
    }
    return 'completed'
  }
  if (status === 'cancelled' || status === 'failed') {
    await admin
      .from('subscription_payments')
      .update({ status })
      .eq('id', payment.id)
      .eq('status', 'pending')
    return status
  }
  return 'pending'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const cfg = payDunyaConfig()
  if (!cfg) return json(503, { error: "Le paiement en ligne n'est pas encore configuré." })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // --- Notification de PayDunya (formulaire) --------------------------------
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await req.text())
    const hash = form.get('data[hash]') ?? ''
    const token = form.get('data[invoice][token]') ?? ''
    if (!sameString(hash, await sha512Hex(cfg.masterKey)) || !validToken(token)) {
      return json(400, { error: 'Notification refusée.' })
    }
    const result = await syncPayment(admin, cfg, token)
    // Vérification impossible pour l'instant : on le dit, pour que la notification soit renvoyée.
    if (result === 'error') return json(503, { error: 'Vérification momentanément impossible.' })
    return json(200, { ok: true })
  }

  // --- Appels de l'application ----------------------------------------------
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return json(401, { error: 'Connexion requise.' })
  const { data: userData, error: userError } = await admin.auth.getUser(bearer)
  if (userError || !userData?.user) return json(401, { error: 'Session invalide.' })

  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, active, pharmacy_id')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (!caller || !caller.active || caller.role !== 'admin' || !caller.pharmacy_id) {
    return json(403, { error: "Seul l'administrateur de la pharmacie peut gérer l'abonnement." })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Requête invalide.' })
  }

  if (body.action === 'checkout') {
    if (typeof body.plan !== 'string') return json(400, { error: 'Offre invalide.' })
    const { data: plan } = await admin
      .from('plans')
      .select('code, label, amount, months')
      .eq('code', body.plan)
      .maybeSingle()
    if (!plan) return json(400, { error: 'Offre invalide.' })

    const { data: pharmacy } = await admin
      .from('pharmacies')
      .select('name')
      .eq('id', caller.pharmacy_id)
      .maybeSingle()

    // Plafond : pas plus de 5 demandes de paiement par heure et par pharmacie.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('subscription_payments')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', caller.pharmacy_id)
      .gte('created_at', since)
    if ((count ?? 0) >= 5) {
      return json(429, { error: 'Trop de demandes de paiement. Réessayez dans une heure.' })
    }

    const { data: payment, error: insertError } = await admin
      .from('subscription_payments')
      .insert({
        pharmacy_id: caller.pharmacy_id,
        plan: plan.code,
        amount: plan.amount,
        months: plan.months,
        created_by: caller.id,
      })
      .select('id')
      .single()
    if (insertError || !payment) return json(500, { error: 'Paiement impossible pour le moment.' })

    const appUrl = (Deno.env.get('APP_URL') ?? 'https://pharmacaisse.vercel.app').replace(/\/+$/, '')
    const created = await payDunya(`${cfg.base}/checkout-invoice/create`, {
      method: 'POST',
      headers: cfg.headers,
      body: JSON.stringify({
        invoice: {
          total_amount: Number(plan.amount),
          description: `${plan.label} — ${pharmacy?.name ?? 'Pharmacie'}`,
        },
        store: { name: 'PharmaCaisse', website_url: appUrl },
        custom_data: { payment_id: String(payment.id), pharmacy_id: caller.pharmacy_id },
        actions: {
          return_url: `${appUrl}/abonnement`,
          cancel_url: `${appUrl}/abonnement?annule=1`,
          callback_url: `${supabaseUrl}/functions/v1/billing`,
        },
      }),
    })
    if (!created || created.response_code !== '00' || !validToken(created.token)) {
      console.error('billing: création de facture refusée', created?.response_code, created?.response_text)
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return json(502, { error: 'Le service de paiement est indisponible. Réessayez dans un instant.' })
    }

    // Sans jeton enregistré, un paiement ne pourrait jamais être rapproché :
    // on ne donne pas la page de paiement si l'écriture échoue.
    const { error: tokenError } = await admin
      .from('subscription_payments')
      .update({ provider_token: created.token })
      .eq('id', payment.id)
    if (tokenError) {
      console.error('billing: jeton non enregistré', tokenError.message)
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return json(500, { error: 'Paiement impossible pour le moment. Réessayez dans un instant.' })
    }
    return json(200, { url: created.response_text, token: created.token })
  }

  if (body.action === 'verify') {
    if (!validToken(body.token)) return json(400, { error: 'Référence de paiement invalide.' })
    // Le paiement doit appartenir à la pharmacie de l'appelant.
    const { data: own } = await admin
      .from('subscription_payments')
      .select('id')
      .eq('provider_token', body.token)
      .eq('pharmacy_id', caller.pharmacy_id)
      .maybeSingle()
    if (!own) return json(404, { error: 'Paiement introuvable.' })
    return json(200, { status: await syncPayment(admin, cfg, body.token) })
  }

  return json(400, { error: 'Action inconnue.' })
})
