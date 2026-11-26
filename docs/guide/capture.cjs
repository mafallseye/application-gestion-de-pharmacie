// Refait les captures d'écran du guide depuis l'application lancée en local (npm run dev -- --port 5199).
// Identifiants lus dans l'environnement, jamais écrits ici :
//   TEST_EMAILS="admin-avec-pharmacie,compte-sans-pharmacie"  TEST_PASSWORD="…"
//   NODE_PATH=$(npm root -g) node docs/guide/capture.cjs
// Les adresses e-mail des comptes de démonstration sont remplacées à l'écran par des adresses fictives.
// Le script ne valide aucun formulaire : il ouvre les écrans et les fenêtres, puis les referme.
const path = require('path')
const { BASE_URL, launchFrench, newContext, signIn, settle } = require('./capture-lib.cjs')

const OUT = process.env.GUIDE_CAPTURES_DIR || path.join(__dirname, 'captures')
const SCALE = Number(process.env.GUIDE_SCALE || 2)
const [ADMIN, NEWCOMER] = (process.env.TEST_EMAILS || '').split(',').map((s) => s.trim())
const PASSWORD = process.env.TEST_PASSWORD

/** Remplace à l'affichage les adresses de démonstration et l'adresse technique du webhook. */
function maskScript() {
  const fake = (address) => (/caissier/i.test(address) ? 'moussa' : 'aminata') + '@pharmacieduplateau.example'
  const pattern = /[\w.+-]+@example\.com/g
  const clean = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      if (node.nodeValue.includes('@example.com')) node.nodeValue = node.nodeValue.replace(pattern, fake)
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('[title*="@example.com"]').forEach((el) => el.setAttribute('title', el.title.replace(pattern, fake)))
      root.querySelectorAll('input').forEach((el) => {
        if (el.value.includes('supabase.co')) el.value = 'https://…/sale-payments?pharmacy=…'
      })
    }
  }
  const start = () => {
    clean(document.body)
    new MutationObserver(() => clean(document.body)).observe(document.body, { childList: true, subtree: true, characterData: true })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
}

async function main() {
  if (!ADMIN || !PASSWORD) throw new Error('TEST_EMAILS et TEST_PASSWORD sont requis.')
  const browser = await launchFrench()
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null
  const want = (name) => !only || only.test(name)
  const jpg = (name) => ({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 84 })
  const card = (page, title) => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first()
  const go = async (page, route) => {
    await page.goto(BASE_URL + route, { waitUntil: 'load' })
    await settle(page)
  }
  /** Capture la zone de contenu (sans la barre latérale), limitée en hauteur. */
  const shotMain = async (page, name, height) => {
    const box = await page.locator('main').boundingBox()
    const full = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.screenshot({ ...jpg(name), fullPage: true, clip: { x: box.x, y: 0, width: box.width, height: Math.min(height ?? full, full) } })
  }

  // ——— Écrans hors session ———
  if (want('inscription')) {
    const ctx = await newContext(browser, { scale: SCALE, height: 760 })
    const page = await ctx.newPage()
    await go(page, '/inscription')
    await page.screenshot(jpg('inscription'))
    await ctx.close()
  }
  if (want('creer-pharmacie') && NEWCOMER) {
    const ctx = await newContext(browser, { scale: SCALE, height: 760 })
    await ctx.addInitScript(maskScript)
    const page = await ctx.newPage()
    await signIn(page, NEWCOMER, PASSWORD)
    await page.getByRole('heading', { level: 1 }).waitFor()
    await settle(page)
    // Exemple de saisie pour la capture ; le formulaire n'est pas envoyé.
    await page.getByLabel('Nom de la pharmacie').fill('Pharmacie du Plateau')
    await page.getByLabel('Téléphone').fill('33 821 45 67')
    await page.getByLabel('Adresse').fill('12, avenue Georges Pompidou, Dakar')
    await page.getByLabel('Votre nom complet').fill('Dr Aminata Sow')
    await page.getByLabel('Votre nom complet').blur()
    await page.screenshot(jpg('creer-pharmacie'))
    await ctx.close()
  }

  // ——— Bureau, administratrice ———
  const ctx = await newContext(browser, { scale: SCALE, height: 900 })
  await ctx.addInitScript(maskScript)
  const page = await ctx.newPage()
  await signIn(page, ADMIN, PASSWORD)

  if (want('tableau-de-bord')) {
    await go(page, '/')
    await page.screenshot({ ...jpg('tableau-de-bord'), fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1030 } })
    // Panneau du bouton d'aide (en bas à droite de chaque écran).
    await page.getByRole('button', { name: /Besoin d.aide/ }).click()
    await settle(page, 400)
    await page.getByRole('group', { name: 'Aide et assistance' }).screenshot(jpg('aide'))
    await page.keyboard.press('Escape')
  }
  if (want('medicaments')) {
    await go(page, '/medicaments')
    await shotMain(page, 'medicaments', 790)
    await page.getByRole('button', { name: 'Ajouter un médicament' }).click()
    await settle(page, 400)
    await page.locator('dialog[open]').screenshot(jpg('medicament-ajout'))
    await page.keyboard.press('Escape')
  }
  if (want('categories')) {
    await go(page, '/categories')
    await shotMain(page, 'categories', 560)
    await go(page, '/fournisseurs')
    await shotMain(page, 'fournisseurs', 520)
  }
  if (want('caisse')) {
    await go(page, '/caisse')
    const add = (name) => page.locator('li').filter({ hasText: name }).getByRole('button', { name: /Ajouter/ }).first().click()
    await add('Doliprane 1000 mg')
    await add('Doliprane 1000 mg')
    await add('Vitamine C 500 mg')
    await page.getByLabel('Montant payé').fill('10000')
    await settle(page, 300)
    await shotMain(page, 'caisse', 800)
    // Vente à crédit : un client choisi, un montant inférieur au total.
    await card(page, 'Panier').locator('select').selectOption({ label: 'Ibrahima Fall' }).catch(() => {})
    await page.getByLabel('Montant payé').fill('2000')
    await settle(page, 300)
    await card(page, 'Panier').screenshot(jpg('caisse-credit'))
  }
  if (want('ventes')) {
    await go(page, '/ventes')
    await shotMain(page, 'ventes', 700)
    await page.getByRole('row', { name: /Ibrahima Fall/ }).first().click()
    await settle(page)
    await shotMain(page, 'vente-detail', 665)
    await page.getByRole('button', { name: /^Encaisser/ }).first().click()
    await settle(page, 400)
    await page.locator('dialog[open]').screenshot(jpg('vente-encaisser'))
    await page.keyboard.press('Escape')
    await settle(page, 300)
    await page.getByRole('button', { name: 'Annuler la vente' }).first().click()
    await settle(page, 400)
    await page.locator('dialog[open]').screenshot(jpg('vente-annuler'))
    await page.keyboard.press('Escape')
  }
  if (want('clients')) {
    await go(page, '/clients')
    await shotMain(page, 'clients', 620)
  }
  if (want('utilisateurs')) {
    await go(page, '/utilisateurs')
    await shotMain(page, 'utilisateurs', 380)
    await page.getByRole('button', { name: 'Ajouter un utilisateur' }).click()
    await settle(page, 400)
    await page.locator('dialog[open]').screenshot(jpg('utilisateur-ajout'))
    await page.keyboard.press('Escape')
  }
  if (want('abonnement')) {
    await go(page, '/abonnement')
    await shotMain(page, 'abonnement', 610)
    await card(page, 'Paiement mobile money').screenshot(jpg('mobile-money'))
  }
  if (want('avis')) {
    await go(page, '/')
    await page.getByRole('button', { name: /Besoin d.aide/ }).click()
    await page.getByRole('button', { name: 'Donner mon avis' }).click()
    await settle(page, 400)
    await page.locator('dialog[open]').screenshot(jpg('avis'))
    await page.keyboard.press('Escape')
  }
  await ctx.close()

  // ——— Téléphone ———
  if (want('mobile')) {
    const phone = await newContext(browser, { width: 390, height: 844, scale: SCALE, mobile: true })
    await phone.addInitScript(maskScript)
    const mobile = await phone.newPage()
    await signIn(mobile, ADMIN, PASSWORD)
    await go(mobile, '/')
    await mobile.screenshot(jpg('mobile-tableau-de-bord'))
    await go(mobile, '/caisse')
    await mobile.locator('li').filter({ hasText: 'Doliprane 1000 mg' }).getByRole('button', { name: /Ajouter/ }).first().click()
    await settle(mobile, 300)
    await mobile.screenshot(jpg('mobile-caisse'))
    await card(mobile, 'Panier').scrollIntoViewIfNeeded()
    await mobile.evaluate(() => window.scrollBy(0, -70))
    await settle(mobile, 300)
    await mobile.screenshot(jpg('mobile-panier'))
    await phone.close()
  }
  await browser.close()
}

main().catch((error) => {
  console.error(String(error.message || error).replace(/[\w.+-]+@example\.com/g, '<adresse>'))
  process.exit(1)
})
