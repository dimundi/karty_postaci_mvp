const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { chromium } = require('playwright-core')
const { renderSocialPoster } = require('./talent-social-poster.cjs')
const { ASSETS, defaultTemplate, renderTemplate, fitText } = require('../src/talentTemplates/template.cjs')
function validateTemplate(value) {
  const defaults = defaultTemplate()
  value = { ...value, verticalPadding: value?.verticalPadding ?? defaults.verticalPadding }
  if (value?.schemaVersion !== 2 || value.page?.width !== defaults.page.width || value.page?.height !== defaults.page.height) throw new Error('Nieprawidłowy format wspólnego szablonu talentu.')
  const limits = { padding: [2, 15], verticalPadding: [2, 15], statusHeight: [5, 22], iconGap: [0, 10], textGap: [0, 12], fontSize: [9, 20], minFontSize: [9, 20], lineHeight: [1, 2] }
  for (const [key, [min, max]] of Object.entries(limits)) if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error(`Nieprawidłowe ustawienie: ${key}.`)
  if (value.minFontSize > value.fontSize || typeof value.autoFit !== 'boolean') throw new Error('Nieprawidłowe dopasowanie tekstu.')
  for (const key of ['color', 'flavorColor', 'background']) if (!/^#[0-9a-f]{6}$/i.test(value[key])) throw new Error('Nieprawidłowy kolor.')
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, key === 'page' ? defaults.page : value[key]]))
}
function validatePreview(value) {
  if (value?.isAction !== undefined && typeof value.isAction !== 'boolean') throw new Error('Nieprawidłowa flaga akcji.')
  if (!value || !['name', 'flavorDescription', 'description'].every((key) => typeof value[key] === 'string' && value[key].length <= (key === 'name' ? 300 : 20000)) || !Number.isInteger(value.usesPerMission) || value.usesPerMission < 0 || value.usesPerMission > 3 || typeof value.isDarkGift !== 'boolean') throw new Error('Nieprawidłowe dane podglądu.')
  return value
}
async function readBody(request) {
  const parts = []; let bytes = 0
  for await (const chunk of request) { bytes += chunk.length; if (bytes > 128 * 1024) throw new Error('Żądanie jest zbyt duże.'); parts.push(chunk) }
  return JSON.parse(Buffer.concat(parts).toString('utf8'))
}
function installTalentTemplates(app, options = {}) {
  const file = options.file || '/cardTemplates/talenty/szablon.json'
  const assetsDirectory = options.assetsDirectory || '/cardTemplates/talenty/Links'
  const assetCache = new Map()
  const resolveAsset = (name) => {
    if (!Object.values(ASSETS).includes(name)) throw new Error('Nieznana grafika szablonu talentu.')
    if (name === ASSETS.oncePerScene) return path.resolve(__dirname, '../src/assets/once.svg')
    const target = path.join(assetsDirectory, name)
    if (fs.realpathSync(path.dirname(fs.realpathSync(target))) !== fs.realpathSync(assetsDirectory)) throw new Error('Grafika musi znajdować się w katalogu Links talentów.')
    return target
  }
  const read = () => {
    if (!fs.existsSync(file)) return { template: defaultTemplate(), revision: null }
    const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    return { template: validateTemplate(JSON.parse(content)), revision: createHash('sha256').update(content).digest('hex') }
  }
  async function readAsset(name) {
    const source = fs.readFileSync(resolveAsset(name), 'utf8')
    if (![ASSETS.hex, ASSETS.square, ASSETS.oncePerScene].includes(name)) return source
    const hash = createHash('sha256').update(source).digest('hex')
    if (!assetCache.has(hash)) assetCache.set(hash, (async () => {
      // These exports contain large empty artboards. Trim only the served viewBox.
      const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
      try {
        const page = await browser.newPage()
        await page.setContent(source)
        const box = await page.evaluate(() => { const b = document.querySelector('svg').getBBox(); return [b.x - .5, b.y - .5, b.width + 1, b.height + 1] })
        return source.replace(/\bviewBox="[^"]*"/, `viewBox="${box.join(' ')}"`)
      } finally { await browser.close() }
    })().catch((error) => { assetCache.delete(hash); throw error }))
    return assetCache.get(hash)
  }
  const endpoint = (handler) => async (request, response) => {
    try { await handler(request, response) } catch (error) { response.status(error.status || 400).json({ error: error.message || 'Błąd szablonu talentu.' }) }
  }
  app.get('/api/talent-asset', endpoint(async (request, response) => response.type('image/svg+xml').send(await readAsset(request.query.file))))
  app.get('/api/talent-template', endpoint((_request, response) => response.json(read())))
  app.post('/api/talent-template', endpoint(async (request, response) => {
    const input = await readBody(request), template = validateTemplate(input.template)
    if (read().revision !== input.revision) { const error = new Error('Szablon został zmieniony. Wczytaj go ponownie przed zapisem.'); error.status = 409; throw error }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
    fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(template, null, 2)}\n`); fs.renameSync(`${file}.tmp`, file)
    response.json(read())
  }))
  const renderMaterial = async (format, input) => {
    if (input.sequenceNumber !== undefined && (!Number.isSafeInteger(input.sequenceNumber) || input.sequenceNumber < 1)) throw new Error('Nieprawidłowy numer kolejny talentu.')
    const template = validateTemplate(input.template), talent = validatePreview(input.preview)
    const images = Object.fromEntries(await Promise.all(Object.entries(ASSETS).map(async ([key, name]) => [key, `data:image/svg+xml;base64,${Buffer.from(await readAsset(name)).toString('base64')}`])))
    const fontUrl = `data:font/ttf;base64,${fs.readFileSync(path.resolve(__dirname, '../src/assets/fonts/NotoSans-Regular.ttf')).toString('base64')}`
    const fontUrls = Object.fromEntries(Object.entries({ regular: 'R', semibold: 'RZ', bold: 'RB', italic: 'RI', boldItalic: 'RBI' }).map(([key, suffix]) => [key, `data:font/ttf;base64,${fs.readFileSync(path.resolve(__dirname, `../src/assets/fonts/LinLibertine_${suffix}.ttf`)).toString('base64')}`]))
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    try {
      const page = await browser.newPage({ deviceScaleFactor: format === 'png' ? 4 : 1 })
      await page.setContent(renderTemplate(template, talent, { fontUrls, images }), { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      const broken = await page.evaluate(() => [...document.images].some((i) => !i.complete || !i.naturalWidth))
      if (broken) throw new Error('Nie udało się wczytać grafiki szablonu.')
      if ((await page.evaluate(fitText)).length) throw new Error('Tekst nie mieści się w ramce. Zmniejsz czcionkę lub odstępy.')
      if (format === 'png') {
        const card = await page.locator('.card').screenshot({ type: 'png' })
        const asset = (name, mime = 'image/webp') => `data:${mime};base64,${fs.readFileSync(path.resolve(__dirname, '../src/assets', name)).toString('base64')}`
        const poster = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 })
        const cover = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../src/assets/social/klanarchia-cover-frontandback.png')).toString('base64')}`
        await poster.setContent(renderSocialPoster({ fontUrl, sequenceNumber: input.sequenceNumber, serifUrl: 'data:font/ttf;base64,' + fs.readFileSync(path.resolve(__dirname, '../src/assets/fonts/CormorantGaramond.ttf')).toString('base64'), card, cover, logo: asset('klanarchia_logo.webp'), publisher: asset('WTF_logo_zlote.webp'), gamefound: asset('social/gamefound-back-now-official.png', 'image/png') }), { waitUntil: 'load' })
        await poster.evaluate(() => document.fonts.ready)
        if (await poster.evaluate(() => [...document.images].some((i) => !i.complete || !i.naturalWidth))) throw new Error('Nie udało się wczytać grafik plakatu.')
        const png = await poster.screenshot({ type: 'png' })
        return png
      } else {
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
        return pdf
      }
    } finally { await browser.close() }
  }
  const exportTalent = (format) => endpoint(async (request, response) => {
    const buffer = await renderMaterial(format, await readBody(request))
    response.type(format === 'png' ? 'image/png' : 'application/pdf').set('Content-Disposition', `attachment; filename="${format === 'png' ? 'moj-talent-klanarchia.png' : 'proba-talentu.pdf'}"`).send(buffer)
  })
  app.post('/api/talent-template-pdf', exportTalent('pdf'))
  app.post('/api/talent-template-social', exportTalent('png'))
  return { renderMaterial, readTemplate: read }
}
module.exports = { installTalentTemplates, validateTemplate, validatePreview }
