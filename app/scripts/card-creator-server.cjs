const fs = require('node:fs/promises')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const BASE = '/cardTemplates'
const ROOT = path.join(BASE, 'projekty')
const DEFINITIONS_FILE = path.join(BASE, 'definicje-pol.json')
const PAGE = { width: 595.2756, height: 841.8898 }
const TYPES = ['factionAspect', 'heat', 'talent', 'darkInstinct', 'darkGift', 'characterName', 'clanName']
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function projectPath(name) {
  if (typeof name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,79}$/u.test(name) || name !== name.trim() || /^(link|links|con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(name)) {
    throw new Error('Nazwa projektu może zawierać litery, cyfry, spacje, myślnik i podkreślenie. Nie może być nazwą zarezerwowaną, np. link.')
  }
  return path.join(ROOT, name)
}

async function existingProjectPath(name) {
  const directory = projectPath(name)
  try { await fs.access(path.join(directory, 'projekt.json')); return directory } catch {}
  const legacy = path.join(BASE, 'klany', name)
  try { await fs.access(path.join(legacy, 'projekt.json')); return legacy } catch {}
  return directory
}

async function linkDirectory() {
  for (const directory of [BASE, path.join(BASE, 'klany')]) {
    const names = await fs.readdir(directory).catch(() => [])
    const name = names.find((name) => /^links?$/i.test(name))
    if (name) return path.join(directory, name)
  }
  throw new Error('Dodaj katalog link do cardTemplates.')
}

async function assetPath(name) {
  if (typeof name !== 'string' || path.basename(name) !== name || !MIME[path.extname(name).toLowerCase()]) {
    throw new Error('Nieprawidłowy plik graficzny.')
  }
  const directory = await linkDirectory()
  const file = path.join(directory, name)
  const real = await fs.realpath(file)
  if (path.dirname(real) !== await fs.realpath(directory)) throw new Error('Plik musi znajdować się w katalogu link.')
  return file
}

function validateProject(project) {
  if (!project || project.version !== 1 || !Array.isArray(project.layers) || !Array.isArray(project.elements)) throw new Error('Nieprawidłowy projekt.')
  if (!project.layers.length || project.layers.length > 100 || project.elements.length > 1000) throw new Error('Nieprawidłowa liczba warstw lub elementów.')
  const layerIds = new Set()
  for (const [index, layer] of project.layers.entries()) {
    if (!layer || typeof layer.id !== 'string' || layerIds.has(layer.id) || layer.number !== index || typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean') throw new Error('Nieprawidłowe warstwy.')
    layerIds.add(layer.id)
    if (layer.name !== undefined && (typeof layer.name !== 'string' || layer.name.length > 100)) throw new Error('Nazwa warstwy może mieć maksymalnie 100 znaków.')
    if (!layer.name?.trim()) layer.name = String(layer.number)
  }
  if (typeof project.clanName !== 'string' || typeof project.clanId !== 'string') throw new Error('Brak danych klanu.')
  project.kind ??= 'clan'
  if (!['clan', 'archetype'].includes(project.kind)) throw new Error('Nieprawidłowy typ karty.')
  project.variants ??= []
  if (!Array.isArray(project.variants) || project.variants.length > 100) throw new Error('Nieprawidłowe warianty.')
  const variantIds = new Set()
  for (const variant of project.variants) {
    if (!variant || typeof variant.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(variant.id) || variantIds.has(variant.id) || typeof variant.name !== 'string' || !variant.name.trim() || typeof variant.clanId !== 'string') throw new Error('Nieprawidłowy wariant.')
    variantIds.add(variant.id)
  }
  const ids = new Set()
  const globalFields = readDefinitions().fields
  if (project.view !== undefined) {
    const view = project.view
    if (!view || typeof view.selectedVariantId !== 'string' || (view.selectedVariantId && !variantIds.has(view.selectedVariantId)) || !Array.isArray(view.visibleVariantIds) || view.visibleVariantIds.some((id) => !variantIds.has(id))) throw new Error('Nieprawidłowe ustawienia podglądu wariantów.')
  }
  for (const element of project.elements) {
    if (!element || typeof element.id !== 'string' || !element.id || ids.has(element.id) || !layerIds.has(element.layerId) || !['image', 'text', 'field'].includes(element.kind)) throw new Error('Nieprawidłowy element.')
    ids.add(element.id)
    element.variantIds ??= []
    if (!Array.isArray(element.variantIds) || element.variantIds.some((id) => !variantIds.has(id))) throw new Error('Nieprawidłowe przypisanie elementu do wariantu.')
    if (element.kind === 'field' && element.definitionId) {
      const definition = globalFields.find((definition) => definition.id === element.definitionId)
      if (!definition) throw new Error('Brak globalnej definicji pola.')
      Object.assign(element, { fieldType: definition.type, label: definition.label, width: definition.width, height: definition.height, fontSize: definition.fontSize, markStyle: definition.markStyle })
    }
    if (![element.x, element.y, element.width, element.height].every(Number.isFinite) || element.x < 0 || element.y < 0 || element.width <= 0 || element.height <= 0 || element.x + element.width > PAGE.width + .01 || element.y + element.height > PAGE.height + .01) throw new Error('Element musi mieścić się na stronie A4.')
    if (element.kind === 'image' && typeof element.source !== 'string') throw new Error('Brak pliku obrazu.')
    if (element.kind === 'text' && typeof element.text !== 'string') throw new Error('Brak treści tekstu.')
    if (element.kind !== 'image' && (!Number.isFinite(element.fontSize) || element.fontSize < 1 || element.fontSize > 200)) throw new Error('Nieprawidłowa wielkość czcionki.')
    if (element.kind === 'field' && (!globalFields.some((definition) => definition.type === element.fieldType) || typeof element.label !== 'string' || !['x', 'v'].includes(element.markStyle))) throw new Error('Nieprawidłowe pole.')
    if (element.kind === 'field' && element.definitionId && !globalFields.some((definition) => definition.id === element.definitionId && definition.type === element.fieldType)) throw new Error('Nieprawidłowa definicja pola.')
  }
  project.page = { format: 'A4', ...PAGE }
  return project
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 4 * 1024 * 1024) throw new Error('Projekt jest zbyt duży.')
  }
  return JSON.parse(body)
}

function forVariant(project, variantId) {
  if (!project.variants?.length) return project
  const variant = project.variants.find((variant) => variant.id === variantId)
  if (!variant) throw new Error('Wybierz jeden wariant do eksportu.')
  return { ...project, clanName: variant.name, clanId: variant.clanId, elements: project.elements.filter((element) => !element.variantIds?.length || element.variantIds.includes(variantId)) }
}

function validateDefinitions(library) {
  if (!library || library.version !== 1 || !Array.isArray(library.fields) || library.fields.length > 1000) throw new Error('Nieprawidłowe definicje pól.')
  const ids = new Set(), types = new Set()
  for (const field of library.fields) {
    if (field?.kind === 'checkboxGroup') { field.kind = 'checkbox'; field.aggregation = 'checkedCount' }
    if (field) delete field.count
    if (!field || typeof field.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(field.id) || ids.has(field.id) || typeof field.type !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(field.type) || types.has(field.type) || typeof field.label !== 'string' || !field.label.trim() || !['checkbox', 'text'].includes(field.kind)) throw new Error('Nieprawidłowa definicja pola.')
    const expected = ['darkGift', 'characterName', 'clanName'].includes(field.type) ? 'text' : 'checkbox'
    if (TYPES.includes(field.type) && field.kind !== expected) throw new Error('Nieprawidłowy rodzaj pola.')
    if (field.aggregation !== undefined && (field.kind !== 'checkbox' || field.aggregation !== 'checkedCount')) throw new Error('Nieprawidłowy sposób liczenia wartości.')
    field.width ??= field.kind === 'text' ? 180 : 14
    field.height ??= field.kind === 'text' ? (field.type === 'darkGift' ? 60 : 18) : 14
    field.fontSize ??= 10
    field.markStyle ??= field.type === 'talent' ? 'v' : 'x'
    if (![field.width, field.height, field.fontSize].every(Number.isFinite) || field.width < 1 || field.width > PAGE.width || field.height < 1 || field.height > PAGE.height || field.fontSize < 1 || field.fontSize > 200 || !['x', 'v'].includes(field.markStyle)) throw new Error('Nieprawidłowy rozmiar lub znak zaznaczenia.')
    ids.add(field.id); types.add(field.type)
  }
  if (TYPES.some((type) => !types.has(type))) throw new Error('Nie można usunąć definicji pól używanych przez dotychczasowe karty.')
  return library
}
function readDefinitions() { return validateDefinitions(JSON.parse(readFileSync(DEFINITIONS_FILE, 'utf8'))) }

function fieldsConfig(project, variantId) {
  project = forVariant(project, variantId)
  const definitions = readDefinitions().fields
  const fields = []
  const counters = { heat: 0, darkInstinct: 0 }
  for (const layer of project.layers.filter((layer) => layer.visible)) {
    for (const element of project.elements.filter((element) => element.layerId === layer.id && element.kind === 'field')) {
      const field = { id: element.id, type: element.fieldType, label: element.label, x: element.x, y: element.y, width: element.width, height: element.height, fontSize: element.fontSize, markStyle: element.markStyle }
      const definition = definitions.find((definition) => definition.type === element.fieldType)
      field.definitionId = definition.id
      if (definition.aggregation) field.aggregation = definition.aggregation
      if (element.parentId) field.parentId = element.parentId
      if (Object.hasOwn(counters, element.fieldType)) {
        field.order = ++counters[element.fieldType]
      }
      fields.push(field)
    }
  }
  const allowed = project.kind === 'archetype' ? ['characterName', 'clanName'] : TYPES.filter((type) => !['characterName', 'clanName'].includes(type))
  if (fields.some((field) => TYPES.includes(field.type) && !allowed.includes(field.type))) throw new Error('Typy pól nie pasują do wybranego typu karty. Zmień typ karty lub pól przed eksportem.')
  const base = { version: 1, templateFile: 'karta.pdf', coordinateOrigin: 'top-left', fields }
  return project.kind === 'archetype' ? { ...base, archetypeName: project.clanName, archetypeId: project.clanId } : { ...base, clanId: project.clanId, clanName: project.clanName, logoFile: '' }
}

async function renderHtml(project, variantId) {
  project = forVariant(project, variantId)
  const font = (await fs.readFile(path.resolve('src/assets/fonts/NotoSans-Regular.ttf'))).toString('base64')
  let content = ''
  for (const layer of project.layers.filter((layer) => layer.visible)) {
    for (const element of project.elements.filter((element) => element.layerId === layer.id)) {
      const style = `position:absolute;left:${element.x}pt;top:${element.y}pt;width:${element.width}pt;height:${element.height}pt;`
      if (element.kind === 'image') {
        const image = (await fs.readFile(await assetPath(element.source))).toString('base64')
        content += `<img alt="" style="${style}object-fit:contain" src="data:${MIME[path.extname(element.source).toLowerCase()]};base64,${image}">`
      } else if (element.kind === 'text') {
        content += `<div style="${style}font-size:${element.fontSize}pt;line-height:1.2;white-space:pre-wrap;overflow:hidden">${escapeHtml(element.text)}</div>`
      } else if (element.outline) {
        content += `<div style="${style}border:0.7pt solid #111"></div>`
      }
    }
  }
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${escapeHtml(project.clanName || 'Szablon karty')}</title><style>@font-face{font-family:CardFont;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:CardFont,sans-serif;color:#111}.card{position:relative;width:${PAGE.width}pt;height:${PAGE.height}pt;overflow:hidden;background:white}@page{size:A4;margin:0}@media screen{body{background:#ddd}.card{margin:auto}}</style></head><body><div class="card">${content}</div></body></html>`
}

function installCardCreator(app) {
  const endpoint = (handler) => async (request, response) => {
    try { await handler(request, response) } catch (error) { response.status(400).json({ error: error.message }) }
  }
  app.get('/api/field-definitions', endpoint(async (_request, response) => response.json(readDefinitions())))
  app.post('/api/field-definitions', endpoint(async (request, response) => {
    const library = validateDefinitions(await readBody(request))
    await fs.writeFile(DEFINITIONS_FILE, JSON.stringify(library, null, 2) + '\n')
    response.json({ saved: true, library })
  }))
  app.get('/api/card-assets', endpoint(async (_request, response) => {
    const directory = await linkDirectory()
    const entries = await fs.readdir(directory, { withFileTypes: true })
    response.json(entries.filter((entry) => entry.isFile() && MIME[path.extname(entry.name).toLowerCase()]).map((entry) => ({ name: entry.name, url: `/api/card-asset?file=${encodeURIComponent(entry.name)}` })))
  }))
  app.get('/api/card-asset', endpoint(async (request, response) => {
    const file = await assetPath(request.query.file)
    response.type(MIME[path.extname(file).toLowerCase()]).send(await fs.readFile(file))
  }))
  app.get('/api/card-projects', endpoint(async (_request, response) => {
    const projects = new Set()
    for (const directory of [ROOT, path.join(BASE, 'klany')]) {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
      for (const entry of entries.filter((entry) => entry.isDirectory() && !/^links?$/i.test(entry.name))) {
        try { projectPath(entry.name); await fs.access(path.join(directory, entry.name, 'projekt.json')); projects.add(entry.name) } catch {}
      }
    }
    response.json([...projects].sort())
  }))
  app.get('/api/card-project', endpoint(async (request, response) => {
    response.json(validateProject(JSON.parse(await fs.readFile(path.join(await existingProjectPath(request.query.name), 'projekt.json'), 'utf8'))))
  }))
  app.post('/api/card-project', endpoint(async (request, response) => {
    const { name, project, exportPdf, variantId } = await readBody(request)
    const directory = await existingProjectPath(name)
    validateProject(project)
    // Eksport powstaje w pamięci przed zapisem plików, aby błąd nie nadpisał działającego szablonu.
    let html, pdf, fields
    let exportDirectory = directory
    if (exportPdf) {
      fields = fieldsConfig(project, variantId)
      html = await renderHtml(project, variantId)
      if (project.variants.length) exportDirectory = path.join(directory, 'warianty', variantId)
      const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
      try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
      } finally { await browser.close() }
    }
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, 'projekt.json'), JSON.stringify(project, null, 2) + '\n')
    if (exportPdf) {
      await fs.mkdir(exportDirectory, { recursive: true })
      await fs.writeFile(path.join(exportDirectory, 'karta.html'), html)
      await fs.writeFile(path.join(exportDirectory, 'karta.pdf'), pdf)
      await fs.writeFile(path.join(exportDirectory, 'pola.json'), JSON.stringify(fields, null, 2) + '\n')
    }
    response.json({ saved: true, exported: Boolean(exportPdf), directory: `cardTemplates/${path.relative(BASE, directory)}`, exportDirectory: path.relative(BASE, exportDirectory) })
  }))
  app.get('/api/card-output', endpoint(async (request, response) => {
    if (!['karta.html', 'karta.pdf', 'pola.json', 'projekt.json'].includes(request.query.file)) throw new Error('Nieprawidłowy plik.')
    let directory = await existingProjectPath(request.query.name)
    if (request.query.variant && request.query.file !== 'projekt.json') {
      const project = validateProject(JSON.parse(await fs.readFile(path.join(directory, 'projekt.json'), 'utf8')))
      if (!project.variants.some((variant) => variant.id === request.query.variant)) throw new Error('Nieprawidłowy wariant.')
      forVariant(project, request.query.variant)
      directory = path.join(directory, 'warianty', request.query.variant)
    }
    const file = path.join(directory, request.query.file)
    response.sendFile(file)
  }))
}

module.exports = { installCardCreator, validateProject, fieldsConfig, renderHtml, PAGE }
