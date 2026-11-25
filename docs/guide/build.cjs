// Fabrique public/guide-utilisation.pdf à partir de docs/guide/guide.html.
//   NODE_PATH=$(npm root -g) node docs/guide/build.cjs
// Aucune dépendance du projet : Playwright installé globalement suffit.
// Les captures (docs/guide/captures) se refont avec capture.cjs.
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { chromium } = require('playwright')

const SOURCE = path.join(__dirname, 'guide.html')
const OUTPUT = path.join(__dirname, '..', '..', 'public', 'guide-utilisation.pdf')

async function build() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const missing = []
  page.on('requestfailed', (request) => missing.push(request.url()))
  await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)

  // Garde-fous : polices bien chargées, images présentes, aucune page qui déborde.
  const report = await page.evaluate(async () => {
    const fonts = ['600 12px "Bricolage Grotesque"', '400 12px "IBM Plex Sans"'].filter((font) => !document.fonts.check(font))
    const broken = [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute('src'))
    const overflow = [...document.querySelectorAll('.page')]
      .map((section, index) => {
        const body = section.querySelector('.body')
        return body && body.scrollHeight > body.clientHeight + 1 ? `page ${index + 1} : dépasse de ${body.scrollHeight - body.clientHeight}px` : null
      })
      .filter(Boolean)
    const free = [...document.querySelectorAll('.page .body')].map((body, index) => {
      const last = body.lastElementChild.getBoundingClientRect().bottom
      return `p${index + 2} ${Math.round(((body.getBoundingClientRect().bottom - last) / 96) * 25.4)}mm`
    })
    return { fonts, broken, overflow, free, pages: document.querySelectorAll('.page').length }
  })
  const problems = [
    ...missing.map((url) => `fichier introuvable : ${url}`),
    ...report.fonts.map((font) => `police non chargée : ${font}`),
    ...report.broken.map((src) => `image illisible : ${src}`),
    ...report.overflow,
  ]
  if (problems.length > 0) {
    await browser.close()
    throw new Error(`Guide non généré :\n- ${problems.join('\n- ')}`)
  }

  await page.pdf({ path: OUTPUT, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true })
  await browser.close()
  const size = fs.statSync(OUTPUT).size
  console.log(`${path.relative(process.cwd(), OUTPUT)} : ${report.pages} pages, ${(size / 1024 / 1024).toFixed(2)} Mo`)
  console.log(`Place libre en bas de page : ${report.free.join(', ')}`)
}

build().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
