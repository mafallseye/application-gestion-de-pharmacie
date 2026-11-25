// Outils communs aux captures du guide : navigateur en français, polices locales, connexion.
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const FONTS_DIR = path.join(__dirname, 'fonts')
const BASE_URL = process.env.GUIDE_APP_URL || 'http://localhost:5199'

/** Sert les polices de docs/guide/fonts à la place de Google Fonts (injoignable hors ligne). */
async function serveLocalFonts(context) {
  const css = fs
    .readFileSync(path.join(FONTS_DIR, 'fonts.css'), 'utf8')
    .replace(/url\(([^)]+\.woff2)\)/g, 'url(https://fonts.gstatic.com/guide/$1)')
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: css }),
  )
  await context.route('https://fonts.gstatic.com/guide/**', (route) => {
    const file = path.join(FONTS_DIR, path.basename(new URL(route.request().url()).pathname))
    route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(file) })
  })
}

async function newContext(browser, { width = 1280, height = 800, scale = 2, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    colorScheme: 'light',
    isMobile: mobile,
    hasTouch: mobile,
  })
  await serveLocalFonts(context)
  return context
}

async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/connexion`, { waitUntil: 'load' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30000 })
  await settle(page)
}

/** Attend la fin des chargements (squelettes, spinners) et des polices. */
async function settle(page, extra = 500) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(extra)
}

/** Chromium complet (et non le « headless shell ») : lui seul affiche les champs date en JJ/MM/AAAA. */
function launchFrench() {
  return chromium.launch({ channel: 'chromium', args: ['--lang=fr-FR'], env: { ...process.env, LANGUAGE: 'fr' } })
}

module.exports = { chromium, BASE_URL, launchFrench, newContext, signIn, settle }
