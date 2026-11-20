// Abonnement d'une pharmacie, payé par PayDunya (paiement avec redirection).
//
// Appels de l'application (administrateur de la pharmacie, jeton Bearer) :
//   POST { action: 'checkout', plan }   -> { url } : page de paiement PayDunya
//   POST { action: 'verify', token }    -> { status } : vérifie un paiement
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

type PayDunyaConfig = { base: string; headers: Record<string, string>; masterKey: string }

function payDunyaConfig(): PayDunyaConfig | null {
  const masterKey = Deno.env.get('PAYDUNYA_MASTER_KEY')
  const privateKey = Deno.env.get('PAYDUNYA_PRIVATE_KEY')
  const token = Deno.env.get('PAYDUNYA_TOKEN')
  if (!masterKey || !privateKey || !token) return null
  const live = Deno.env.get('PAYDUNYA_MODE') === 'live'
  return {
    base: live ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1',
    masterKey,
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

const validToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(v)

/**
 * Redemande à PayDunya l'état de la facture et met notre paiement à jour.
 * Renvoie 'completed', 'pending', 'cancelled', 'failed' ou 'unknown'.
 */
async function syncPayment(admin: SupabaseClient, cfg: PayDunyaConfig, token: string) {
  const { data: payment } = await admin
    .from('subscription_payments')
    .select('id, amount, status')
    .eq('provider_token', token)
    .maybeSingle()
  if (!payment) return 'unknown'
  if (payment.status === 'completed') return 'completed'

  const res = await fetch(`${cfg.base}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: cfg.headers,
  })
  const info = await res.json().catch(() => null)
  if (!res.ok || !info || info.response_code !== '00') return 'pending'

  const status = String(info.status ?? '')
  if (status === 'completed') {
    const paid = Number(info.invoice?.total_amount)
    const reference = String(info.custom_data?.payment_id ?? '')
    if (paid !== Number(payment.amount) || reference !== String(payment.id)) {
      console.error('billing: paiement incohérent', { token, paid, reference })
      return 'failed'
    }
    const { error } = await admin.rpc('complete_subscription_payment', { p_token: token })
    if (error) {
      console.error('billing: validation impossible', error.message)
      return 'pending'
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
    await syncPayment(admin, cfg, token)
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
    const res = await fetch(`${cfg.base}/checkout-invoice/create`, {
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
    const created = await res.json().catch(() => null)
    if (!res.ok || !created || created.response_code !== '00' || !validToken(created.token)) {
      console.error('billing: création de facture refusée', created?.response_code, created?.response_text)
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return json(502, { error: 'Le service de paiement est indisponible. Réessayez dans un instant.' })
    }

    await admin
      .from('subscription_payments')
      .update({ provider_token: created.token })
      .eq('id', payment.id)
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
