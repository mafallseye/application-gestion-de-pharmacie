// Abonnement d'une pharmacie, payé en ligne (NabooPay ou PayDunya).
//
// Appels de l'application (administrateur de la pharmacie, jeton Bearer) :
//   POST { action: 'checkout', plan }   -> { url, token } : page de paiement
//   POST { action: 'verify', token }    -> { status } : vérifie un paiement
//        (completed, pending, cancelled, failed, review, error, unknown)
// Notifications des prestataires (sans jeton Bearer) :
//   NabooPay : POST JSON signé (en-tête X-Signature, HMAC SHA-256 du corps)
//   PayDunya : POST formulaire (data[hash], data[invoice][token], ...)
//
// Règle de sécurité : on ne croit jamais ce qui arrive du navigateur ou d'une
// notification. Un paiement n'est validé qu'après avoir redemandé son état au
// prestataire avec nos clés (serveur à serveur), et vérifié le montant.
//
// Secrets (Edge Functions > Secrets) :
//   NabooPay : NABOOPAY_API_KEY, NABOOPAY_WEBHOOK_SECRET
//   PayDunya : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN,
//              PAYDUNYA_MODE ('test' par défaut, ou 'live')
//   APP_URL  : adresse publique du site (retour après paiement)
// Si les deux prestataires sont configurés, NabooPay sert aux nouveaux paiements.
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

type Status = 'completed' | 'pending' | 'cancelled' | 'failed' | 'review' | 'error'
type Payment = { id: number; amount: number }
type Checkout = {
  amount: number
  label: string
  description: string
  payment: Payment
  pharmacyId: string
  appUrl: string
  callbackUrl: string
}
type Provider = {
  name: 'naboopay' | 'paydunya'
  /** Crée la page de paiement. null si le prestataire refuse ou est injoignable. */
  create(c: Checkout): Promise<{ url: string; token: string } | null>
  /** État du paiement chez le prestataire, montant contrôlé. */
  check(token: string, payment: Payment): Promise<Status>
}

// Appel à un prestataire : coupure réseau ou réponse illisible donnent null.
async function call(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
    const data = await res.json()
    if (!res.ok || !data || typeof data !== 'object') {
      console.error('billing: réponse refusée', res.status)
      return null
    }
    return data
  } catch (error) {
    console.error('billing: prestataire injoignable', String(error))
    return null
  }
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparaison en temps constant.
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const validToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.-]{6,100}$/.test(v)

// --- NabooPay (API v2) -------------------------------------------------------

function nabooPay(): Provider | null {
  const apiKey = Deno.env.get('NABOOPAY_API_KEY')
  if (!apiKey) return null
  const base = 'https://api.naboopay.com/api/v2'
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  return {
    name: 'naboopay',
    async create(c) {
      const created = await call(`${base}/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          method_of_payment: ['wave', 'orange_money'],
          products: [{ name: c.label, price: c.amount, quantity: 1, description: c.description }],
          success_url: `${c.appUrl}/abonnement?retour=1`,
          error_url: `${c.appUrl}/abonnement?annule=1`,
          // Les frais sont déduits de ce que nous recevons : le client paie le prix affiché.
          fees_customer_side: false,
          is_escrow: false,
          is_merchant: false,
        }),
      })
      if (!created || !validToken(created.order_id) || typeof created.checkout_url !== 'string') return null
      if (!created.checkout_url.startsWith('https://')) return null
      return { url: created.checkout_url, token: created.order_id }
    },
    async check(token, payment) {
      const info = await call(`${base}/transactions/${encodeURIComponent(token)}`, { headers })
      if (!info) return 'error'
      const status = String(info.transaction_status ?? '')
      if (status === 'paid' || status === 'paid_and_blocked') {
        const coherent =
          status === 'paid' && info.order_id === token && Number(info.amount) === Number(payment.amount)
        if (!coherent) {
          console.error('billing: paiement NabooPay reçu mais incohérent', {
            token,
            status,
            amount: info.amount,
            expected: payment.amount,
          })
          return 'review'
        }
        return 'completed'
      }
      if (status === 'cancelled' || status === 'refunded') return 'cancelled'
      return 'pending'
    },
  }
}

// --- PayDunya (paiement avec redirection) ------------------------------------

function payDunya(): (Provider & { masterKey: string }) | null {
  const masterKey = Deno.env.get('PAYDUNYA_MASTER_KEY')
  const privateKey = Deno.env.get('PAYDUNYA_PRIVATE_KEY')
  const token = Deno.env.get('PAYDUNYA_TOKEN')
  if (!masterKey || !privateKey || !token) return null
  const mode = Deno.env.get('PAYDUNYA_MODE') === 'live' ? 'live' : 'test'
  const base =
    mode === 'live' ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1'
  const headers = {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': masterKey,
    'PAYDUNYA-PRIVATE-KEY': privateKey,
    'PAYDUNYA-TOKEN': token,
  }
  return {
    name: 'paydunya',
    masterKey,
    async create(c) {
      const created = await call(`${base}/checkout-invoice/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          invoice: { total_amount: c.amount, description: c.description },
          store: { name: 'PharmaCaisse', website_url: c.appUrl },
          custom_data: { payment_id: String(c.payment.id), pharmacy_id: c.pharmacyId },
          actions: {
            return_url: `${c.appUrl}/abonnement`,
            cancel_url: `${c.appUrl}/abonnement?annule=1`,
            callback_url: c.callbackUrl,
          },
        }),
      })
      if (!created || created.response_code !== '00' || !validToken(created.token)) return null
      if (typeof created.response_text !== 'string' || !created.response_text.startsWith('https://')) {
        return null
      }
      return { url: created.response_text, token: created.token }
    },
    async check(tokenValue, payment) {
      const info = await call(`${base}/checkout-invoice/confirm/${encodeURIComponent(tokenValue)}`, {
        headers,
      })
      if (!info || info.response_code !== '00') return 'error'
      const status = String(info.status ?? '')
      if (status === 'completed') {
        const coherent =
          Number(info.invoice?.total_amount) === Number(payment.amount) &&
          String(info.custom_data?.payment_id ?? '') === String(payment.id) &&
          info.invoice?.token === tokenValue &&
          info.mode === mode
        if (!coherent) {
          console.error('billing: paiement PayDunya reçu mais incohérent', { token: tokenValue, mode: info.mode })
          return 'review'
        }
        return 'completed'
      }
      if (status === 'cancelled' || status === 'failed') return status
      return 'pending'
    },
  }
}

/**
 * Redemande au prestataire l'état du paiement et met notre ligne à jour.
 * 'review' : argent reçu mais montant ou référence incohérents (contrôle manuel).
 * 'error'  : vérification impossible pour l'instant (à retenter).
 */
async function syncPayment(
  admin: SupabaseClient,
  providers: Record<string, Provider | null>,
  token: string,
): Promise<Status | 'unknown'> {
  const { data: payment, error: readError } = await admin
    .from('subscription_payments')
    .select('id, amount, status, provider')
    .eq('provider_token', token)
    .maybeSingle()
  if (readError) return 'error'
  if (!payment) return 'unknown'
  if (payment.status !== 'pending') return payment.status as Status

  const provider = providers[payment.provider]
  if (!provider) return 'error'
  const status = await provider.check(token, { id: payment.id, amount: Number(payment.amount) })

  if (status === 'completed') {
    const { error } = await admin.rpc('complete_subscription_payment', { p_token: token })
    if (error) {
      console.error('billing: validation impossible', error.message)
      return 'error'
    }
    return 'completed'
  }
  if (status === 'review' || status === 'cancelled' || status === 'failed') {
    await admin
      .from('subscription_payments')
      .update({ status })
      .eq('id', payment.id)
      .eq('status', 'pending')
  }
  return status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const naboo = nabooPay()
  const dunya = payDunya()
  const providers = { naboopay: naboo, paydunya: dunya }
  const active = naboo ?? dunya
  if (!active) return json(503, { error: "Le paiement en ligne n'est pas encore configuré." })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // --- Notification NabooPay (JSON signé) -----------------------------------
  const signature = req.headers.get('x-signature')
  if (signature !== null) {
    const secret = Deno.env.get('NABOOPAY_WEBHOOK_SECRET')
    const raw = await req.text()
    if (!secret) return json(401, { error: 'Notification refusée.' })
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
    if (!sameString(signature.trim().toLowerCase(), expected)) {
      return json(401, { error: 'Notification refusée.' })
    }
    let orderId: unknown
    try {
      orderId = JSON.parse(raw)?.order_id
    } catch {
      return json(400, { error: 'Notification illisible.' })
    }
    if (!validToken(orderId)) return json(400, { error: 'Notification illisible.' })
    const result = await syncPayment(admin, providers, orderId)
    // Vérification impossible pour l'instant : on le dit, pour que la notification soit renvoyée.
    if (result === 'error') return json(503, { error: 'Vérification momentanément impossible.' })
    return json(200, { ok: true })
  }

  // --- Notification PayDunya (formulaire) -----------------------------------
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    if (!dunya) return json(400, { error: 'Notification refusée.' })
    const form = new URLSearchParams(await req.text())
    const hash = form.get('data[hash]') ?? ''
    const token = form.get('data[invoice][token]') ?? ''
    const digest = hex(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(dunya.masterKey)))
    if (!sameString(hash, digest) || !validToken(token)) {
      return json(400, { error: 'Notification refusée.' })
    }
    const result = await syncPayment(admin, providers, token)
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
        provider: active.name,
        created_by: caller.id,
      })
      .select('id')
      .single()
    if (insertError || !payment) return json(500, { error: 'Paiement impossible pour le moment.' })

    const appUrl = (Deno.env.get('APP_URL') ?? 'https://pharmacaisse.vercel.app').replace(/\/+$/, '')
    const created = await active.create({
      amount: Number(plan.amount),
      label: plan.label,
      description: `${plan.label} — ${pharmacy?.name ?? 'Pharmacie'}`,
      payment: { id: payment.id, amount: Number(plan.amount) },
      pharmacyId: caller.pharmacy_id,
      appUrl,
      callbackUrl: `${supabaseUrl}/functions/v1/billing`,
    })
    if (!created) {
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return json(502, { error: 'Le service de paiement est indisponible. Réessayez dans un instant.' })
    }

    // Sans référence enregistrée, un paiement ne pourrait jamais être rapproché :
    // on ne donne pas la page de paiement si l'écriture échoue.
    const { error: tokenError } = await admin
      .from('subscription_payments')
      .update({ provider_token: created.token })
      .eq('id', payment.id)
    if (tokenError) {
      console.error('billing: référence non enregistrée', tokenError.message)
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return json(500, { error: 'Paiement impossible pour le moment. Réessayez dans un instant.' })
    }
    return json(200, { url: created.url, token: created.token })
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
    return json(200, { status: await syncPayment(admin, providers, body.token) })
  }

  return json(400, { error: 'Action inconnue.' })
})
