// Paiement d'une vente par mobile money (NabooPay), sur le compte de la pharmacie.
//
// Appels de l'application (jeton Bearer d'un membre actif de la pharmacie) :
//   { action: 'settings_get' }                         admin -> { configured, has_webhook_secret, webhook_url }
//   { action: 'settings_save', api_key, webhook_secret? } admin -> { ok }
//   { action: 'settings_clear' }                       admin -> { ok }
//   { action: 'start', sale_id, amount? }   -> { payment_id, order_id, url, amount }
//   { action: 'verify', order_id }          -> { status }
//   { action: 'cancel', payment_id }        -> { status }
//   status : completed | pending | cancelled | sale_cancelled | review | error | unknown
// Notification NabooPay (sans jeton) : POST ?pharmacy=<id>, JSON signé (X-Signature).
//
// Les clés de chaque pharmacie sont chiffrées en base et ne sortent jamais de
// cette fonction. Une vente n'est créditée qu'après avoir redemandé l'état du
// paiement à NabooPay avec la clé de la pharmacie, et vérifié le montant.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const NABOO = 'https://api.naboopay.com/api/v2'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const validOrderId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.-]{6,100}$/.test(v)
const validSecret = (v: unknown): v is string => typeof v === 'string' && v.trim().length >= 8 && v.trim().length <= 500

// Appel à NabooPay : { status, data } ; status 0 = injoignable ou réponse illisible.
async function naboo(path: string, apiKey: string, init: RequestInit = {}) {
  try {
    const res = await fetch(`${NABOO}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json().catch(() => null)
    return { status: res.status, data: data && typeof data === 'object' ? data : null }
  } catch (error) {
    console.error('sale-payments: NabooPay injoignable', String(error))
    return { status: 0, data: null }
  }
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sameString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function keysOf(admin: SupabaseClient, pharmacyId: string) {
  const { data, error } = await admin.rpc('get_pharmacy_payment_keys', { p_pharmacy: pharmacyId })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return row?.api_key ? { apiKey: row.api_key as string, webhookSecret: (row.webhook_secret ?? null) as string | null } : null
}

/** Redemande l'état à NabooPay et met la vente à jour. */
async function sync(admin: SupabaseClient, orderId: string, pharmacyId: string) {
  const { data: pay, error: readError } = await admin
    .from('sale_mobile_payments')
    .select('id, amount, status, pharmacy_id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (readError) return 'error'
  if (!pay || pay.pharmacy_id !== pharmacyId) return 'unknown'
  if (pay.status !== 'pending') return pay.status as string

  const keys = await keysOf(admin, pharmacyId)
  if (!keys) return 'error'
  const { status: http, data: info } = await naboo(`/transactions/${encodeURIComponent(orderId)}`, keys.apiKey)
  if (http !== 200 || !info) return 'error'

  const state = String(info.transaction_status ?? '')
  if (state === 'paid' || state === 'paid_and_blocked') {
    const coherent = state === 'paid' && info.order_id === orderId && Number(info.amount) === Number(pay.amount)
    if (!coherent) {
      console.error('sale-payments: paiement reçu mais incohérent', { orderId, state, amount: info.amount })
      await admin
        .from('sale_mobile_payments')
        .update({ status: 'review', paid_at: new Date().toISOString() })
        .eq('id', pay.id)
        .eq('status', 'pending')
      return 'review'
    }
    const { data: result, error } = await admin.rpc('complete_sale_mobile_payment', { p_order_id: orderId })
    if (error) {
      console.error('sale-payments: crédit de la vente impossible', error.message)
      return 'error'
    }
    return String(result)
  }
  if (state === 'cancelled' || state === 'refunded') {
    const { data: result, error } = await admin.rpc('cancel_sale_mobile_payment', {
      p_order_id: orderId,
      p_payment_id: null,
    })
    return error ? 'error' : String(result)
  }
  return 'pending'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // --- Notification NabooPay d'une pharmacie --------------------------------
  const signature = req.headers.get('x-signature')
  if (signature !== null) {
    const pharmacyId = new URL(req.url).searchParams.get('pharmacy')
    const raw = await req.text()
    if (!isUuid(pharmacyId)) return json(401, { error: 'Notification refusée.' })
    const keys = await keysOf(admin, pharmacyId)
    if (!keys?.webhookSecret) return json(401, { error: 'Notification refusée.' })
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(keys.webhookSecret),
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
    if (!validOrderId(orderId)) return json(400, { error: 'Notification illisible.' })
    const result = await sync(admin, orderId, pharmacyId)
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
  if (!caller || !caller.active || !caller.pharmacy_id) return json(403, { error: 'Accès refusé.' })
  const pharmacyId: string = caller.pharmacy_id
  const isAdmin = caller.role === 'admin'

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Requête invalide.' })
  }
  const action = body.action

  // --- Réglages (administrateur) --------------------------------------------
  if (action === 'settings_get' || action === 'settings_save' || action === 'settings_clear') {
    if (!isAdmin) return json(403, { error: "Réservé à l'administrateur de la pharmacie." })
    const webhookUrl = `${supabaseUrl}/functions/v1/sale-payments?pharmacy=${pharmacyId}`

    if (action === 'settings_get') {
      const keys = await keysOf(admin, pharmacyId)
      return json(200, {
        configured: Boolean(keys),
        has_webhook_secret: Boolean(keys?.webhookSecret),
        webhook_url: webhookUrl,
      })
    }
    if (action === 'settings_clear') {
      const { error } = await admin.rpc('clear_pharmacy_payment_keys', { p_pharmacy: pharmacyId })
      if (error) return json(500, { error: 'Suppression impossible pour le moment.' })
      return json(200, { ok: true })
    }

    if (!validSecret(body.api_key)) return json(400, { error: "La clé d'API est invalide." })
    const webhookSecret = body.webhook_secret
    if (webhookSecret !== undefined && webhookSecret !== null && webhookSecret !== '' && !validSecret(webhookSecret)) {
      return json(400, { error: 'La clé du webhook est invalide.' })
    }
    // La clé est essayée auprès de NabooPay avant d'être enregistrée.
    const probe = await naboo('/transactions?page=1&limit=1', body.api_key.trim())
    if (probe.status === 401 || probe.status === 403) {
      return json(400, {
        error: 'NabooPay refuse cette clé. Vérifiez-la, ainsi que sa portée (« checkout »).',
      })
    }
    if (probe.status !== 200) {
      return json(502, { error: 'NabooPay est injoignable. Réessayez dans un instant.' })
    }
    const { error } = await admin.rpc('set_pharmacy_payment_keys', {
      p_pharmacy: pharmacyId,
      p_user: caller.id,
      p_api_key: body.api_key.trim(),
      p_webhook_secret: validSecret(webhookSecret) ? webhookSecret.trim() : null,
    })
    if (error) return json(500, { error: 'Enregistrement impossible pour le moment.' })
    return json(200, { ok: true })
  }

  // --- Ouvrir le paiement d'une vente ---------------------------------------
  if (action === 'start') {
    const saleId = Number(body.sale_id)
    if (!Number.isSafeInteger(saleId) || saleId <= 0) return json(400, { error: 'Vente invalide.' })
    const amount = body.amount === undefined || body.amount === null ? null : Number(body.amount)
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
      return json(400, { error: 'Montant invalide.' })
    }

    const { data: started, error: startError } = await admin.rpc('start_sale_mobile_payment', {
      p_user: caller.id,
      p_sale_id: saleId,
      p_amount: amount,
    })
    if (startError || !started) {
      // Les messages levés par la base sont en français et destinés à l'utilisateur.
      const known = ['22023', '42501'].includes(startError?.code ?? '')
      return json(known ? 400 : 500, {
        error: known ? startError!.message : 'Paiement impossible pour le moment.',
      })
    }
    if (started.order_id && started.checkout_url) {
      return json(200, {
        payment_id: started.id,
        order_id: started.order_id,
        url: started.checkout_url,
        amount: Number(started.amount),
      })
    }

    const abandon = async () => {
      await admin.rpc('cancel_sale_mobile_payment', { p_order_id: null, p_payment_id: started.id })
    }
    const keys = await keysOf(admin, pharmacyId)
    if (!keys) {
      await abandon()
      return json(400, { error: "Le paiement par mobile money n'est pas configuré pour cette pharmacie." })
    }
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://pharmacaisse.vercel.app').replace(/\/+$/, '')
    const label = `Vente n° ${started.sale_number}`
    const created = await naboo('/transactions', keys.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        method_of_payment: ['wave', 'orange_money'],
        products: [
          { name: label, price: Number(started.amount), quantity: 1, description: `${label} — ${started.pharmacy_name}` },
        ],
        success_url: `${appUrl}/paiement-mobile?etat=ok`,
        error_url: `${appUrl}/paiement-mobile?etat=echec`,
        // Les frais sont déduits de ce que reçoit la pharmacie : le client paie le prix affiché.
        fees_customer_side: false,
        is_escrow: false,
        is_merchant: false,
      }),
    })
    const orderId = created.data?.order_id
    const url = created.data?.checkout_url
    if (created.status < 200 || created.status >= 300 || !validOrderId(orderId) || typeof url !== 'string' || !url.startsWith('https://')) {
      console.error('sale-payments: création refusée', created.status)
      await abandon()
      const refused = created.status === 401 || created.status === 403
      return json(502, {
        error: refused
          ? "NabooPay refuse la clé de la pharmacie. L'administrateur doit la vérifier."
          : 'Le service de paiement est indisponible. Réessayez dans un instant.',
      })
    }
    const { error: saveError } = await admin
      .from('sale_mobile_payments')
      .update({ order_id: orderId, checkout_url: url })
      .eq('id', started.id)
    if (saveError) {
      console.error('sale-payments: référence non enregistrée', saveError.message)
      await naboo(`/transactions/${encodeURIComponent(orderId)}`, keys.apiKey, { method: 'DELETE' })
      await abandon()
      return json(500, { error: 'Paiement impossible pour le moment. Réessayez dans un instant.' })
    }
    return json(200, { payment_id: started.id, order_id: orderId, url, amount: Number(started.amount) })
  }

  if (action === 'verify') {
    if (!validOrderId(body.order_id)) return json(400, { error: 'Référence de paiement invalide.' })
    return json(200, { status: await sync(admin, body.order_id, pharmacyId) })
  }

  // --- Abandonner un paiement en attente ------------------------------------
  if (action === 'cancel') {
    const paymentId = Number(body.payment_id)
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) return json(400, { error: 'Paiement invalide.' })
    const { data: pay } = await admin
      .from('sale_mobile_payments')
      .select('id, status, order_id, pharmacy_id')
      .eq('id', paymentId)
      .maybeSingle()
    if (!pay || pay.pharmacy_id !== pharmacyId) return json(404, { error: 'Paiement introuvable.' })
    if (pay.status !== 'pending') return json(200, { status: pay.status })

    if (pay.order_id) {
      const keys = await keysOf(admin, pharmacyId)
      if (!keys) return json(200, { status: 'error' })
      // On annule d'abord chez NabooPay : si le client a payé entre-temps,
      // l'annulation est refusée et la vente est créditée au lieu d'être perdue.
      const cancelled = await naboo(`/transactions/${encodeURIComponent(pay.order_id)}`, keys.apiKey, {
        method: 'DELETE',
      })
      if (cancelled.status === 0) return json(200, { status: 'error' })
      if (cancelled.status < 200 || cancelled.status >= 300) {
        const state = await sync(admin, pay.order_id, pharmacyId)
        if (state !== 'pending') return json(200, { status: state })
        return json(200, { status: 'error' })
      }
    }
    const { data: result, error } = await admin.rpc('cancel_sale_mobile_payment', {
      p_order_id: null,
      p_payment_id: pay.id,
    })
    if (error) return json(200, { status: 'error' })
    return json(200, { status: String(result) })
  }

  return json(400, { error: 'Action inconnue.' })
})
