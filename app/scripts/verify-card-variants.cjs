const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright-core')
const { PDFDocument } = require('pdf-lib')
const { validateProject, fieldsConfig, renderHtml, PAGE } = require('./card-creator-server.cjs')

async function verify() {
  const name = `test-warianty-${Date.now()}`
  const directory = path.join('/cardTemplates/projekty', name)
  const layer = { id: 'layer', number: 0, visible: true, locked: false }
  const text = (id, variantIds, value) => ({ id, layerId: 'layer', kind: 'text', x: 30, y: 30, width: 100, height: 30, fontSize: 10, text: value, variantIds })
  const field = (id, variantIds) => ({ ...text(id, variantIds, ''), kind: 'field', fieldType: 'talent', label: id, markStyle: 'v' })
  const project = validateProject({ version: 1, page: PAGE, clanName: '', clanId: '', layers: [layer],
    variants: [{ id: 'soldaci', name: 'Soldaci', clanId: 'soldaci' }, { id: 'hanzyci', name: 'Hanzyci', clanId: 'hanzyci' }],
    elements: [text('common', [], 'Wspólny tekst'), text('soldaci-text', ['soldaci'], 'Tylko Soldaci'), text('hanzyci-text', ['hanzyci'], 'Tylko Hanzyci'), field('common-field', []), field('soldaci-field', ['soldaci']), field('both-field', ['soldaci', 'hanzyci'])],
  })
  assert.throws(() => fieldsConfig(project), /wariant/)
  assert.equal(fieldsConfig(project, 'soldaci').fields.length, 3)
  assert.equal(fieldsConfig(project, 'hanzyci').fields.length, 2)
  assert.equal(fieldsConfig(project, 'hanzyci').clanId, 'hanzyci')
  const html = await renderHtml(project, 'soldaci')
  assert.ok(html.includes('Wspólny tekst') && html.includes('Tylko Soldaci') && !html.includes('Tylko Hanzyci'))
  const old = structuredClone(project)
  delete old.variants
  old.elements = [text('legacy', undefined, 'Stary projekt')]
  validateProject(old)
  assert.deepEqual(old.variants, [])
  assert.deepEqual(old.elements[0].variantIds, [])
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  let created = false
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    await page.goto('http://localhost:8080/#dev-clans')
    const save = await page.request.post('http://localhost:8080/api/card-project', { data: { name, project, exportPdf: false } })
    assert.equal(save.status(), 200)
    created = true
    await page.reload()
    await page.getByLabel('Otwórz projekt').selectOption(name)
    await page.getByLabel('Podgląd wariantu Soldaci').waitFor()
    assert.equal(await page.locator('.creator-element').count(), 6)
    await page.getByLabel('Podgląd wariantu Soldaci').uncheck()
    assert.equal(await page.locator('.creator-element').count(), 4)
    await page.getByLabel('Podgląd wariantu Hanzyci').uncheck()
    assert.equal(await page.locator('.creator-element').count(), 2)
    await page.getByLabel('Podgląd wariantu Soldaci').check()
    await page.getByLabel('Podgląd wariantu Hanzyci').check()
    await page.locator('.creator-element-list button').filter({ hasText: 'Wspólny tekst' }).click()
    await page.getByLabel('Przypisz do wariantu Soldaci').check()
    await page.getByLabel('Przypisz do wariantu Hanzyci').check()
    await page.getByRole('button', { name: 'Menu kreatora' }).click()
    await page.getByRole('menuitem', { name: 'Zapisz projekt Ctrl+S', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Zapisano projekt.json' }).waitFor()
    const saved = JSON.parse(await fs.readFile(path.join(directory, 'projekt.json'), 'utf8'))
    assert.deepEqual(saved.elements[0].variantIds.sort(), ['hanzyci', 'soldaci'])
    // Podgląd kilku wariantów nie może wpływać na zawartość eksportu jednego.
    await page.getByRole('button', { name: 'Wybierz wariant Soldaci', exact: true }).click()
    await page.getByLabel('Podgląd wariantu Hanzyci').check()
    await page.getByRole('button', { name: 'Generuj HTML + PDF + JSON' }).click()
    assert.equal(await page.getByRole('button', { name: 'Generuj wariant', exact: true }).isDisabled(), true)
    await page.getByLabel('Wariant do eksportu').selectOption('soldaci')
    await page.getByRole('button', { name: 'Generuj wariant', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'karta.html' }).waitFor({ timeout: 60000 })
    assert.ok(!(await fs.readFile(path.join(directory, 'warianty/soldaci/karta.html'), 'utf8')).includes('Tylko Hanzyci'))
    await page.getByRole('button', { name: 'Wybierz wariant Hanzyci', exact: true }).click()
    await page.getByRole('button', { name: 'Generuj HTML + PDF + JSON' }).click()
    await page.getByLabel('Wariant do eksportu').selectOption('hanzyci')
    await page.getByRole('button', { name: 'Generuj wariant', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'warianty/hanzyci' }).waitFor({ timeout: 60000 })
    const pdf = await PDFDocument.load(await fs.readFile(path.join(directory, 'warianty/hanzyci/karta.pdf')))
    assert.equal(pdf.getPageCount(), 1)
    assert.ok((await fs.stat(path.join(directory, 'warianty/soldaci/karta.pdf'))).size > 0)
    await page.reload()
    await page.getByLabel('Otwórz projekt').selectOption(name)
    await page.getByLabel('Podgląd wariantu Soldaci').waitFor()
    assert.equal(await page.locator('.creator-element').count(), 4)
    assert.equal(await page.getByRole('button', { name: 'Wybierz wariant Hanzyci', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByLabel('Podgląd wariantu Hanzyci').isChecked(), true)
    assert.equal(await page.getByLabel('Podgląd wariantu Soldaci').isChecked(), false)
    await fs.mkdir('/app/.cache', { recursive: true })
    await page.screenshot({ path: '/app/.cache/variants-preview.png' })
    const archetype = structuredClone(project)
    archetype.kind = 'archetype'
    archetype.elements = [
      { ...field('characterName', []), fieldType: 'characterName' },
      { ...field('clanName', []), fieldType: 'clanName' },
    ]
    validateProject(archetype)
    const archetypeFields = fieldsConfig(archetype, 'soldaci')
    assert.equal(archetypeFields.archetypeName, 'Soldaci')
    assert.equal(archetypeFields.fields[0].type, 'characterName')
    assert.equal(archetypeFields.fields[1].type, 'clanName')
    assert.equal(archetypeFields.clanName, undefined)
    const exportedArchetype = await page.request.post('http://localhost:8080/api/card-project', { data: { name, project: archetype, exportPdf: true, variantId: 'soldaci' } })
    assert.equal(exportedArchetype.status(), 200)
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'warianty/soldaci/pola.json'), 'utf8')).archetypeName, 'Soldaci')
    await page.reload()
    await page.getByLabel('Otwórz projekt').selectOption(name)
    await page.getByLabel('Podgląd wariantu Soldaci').waitFor()
    await page.locator('.creator-object-select').filter({ hasText: 'characterName' }).click()
    assert.equal(await page.getByLabel('Typ pola').inputValue(), 'characterName')
    assert.equal(await page.getByLabel('Typ pola').locator('option').count(), 2)
    console.log('Warianty: wspólne elementy, kilka podglądów, przypisania, zapis/odczyt i niezależne eksporty — OK.')
  } finally {
    await browser.close()
    if (created) {
      for (const variant of ['soldaci', 'hanzyci']) {
        const variantDirectory = path.join(directory, 'warianty', variant)
        for (const file of ['karta.html', 'karta.pdf', 'pola.json']) await fs.unlink(path.join(variantDirectory, file)).catch((error) => { if (error.code !== 'ENOENT') throw error })
        await fs.rmdir(variantDirectory).catch((error) => { if (error.code !== 'ENOENT') throw error })
      }
      await fs.rmdir(path.join(directory, 'warianty')).catch((error) => { if (error.code !== 'ENOENT') throw error })
      await fs.unlink(path.join(directory, 'projekt.json'))
      await fs.rmdir(directory)
    }
  }
}
verify().catch((error) => { console.error(error); process.exitCode = 1 })
