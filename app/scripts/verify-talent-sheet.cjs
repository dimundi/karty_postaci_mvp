const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')
const { chromium } = require('playwright-core')
const { PDFDocument, PDFName, PageSizes } = require('pdf-lib')
const { installTalents } = require('./talents-server.cjs')
const { installTalentTemplates } = require('./talent-templates-server.cjs')

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'talent-sheet-'))
  const file = path.join(root, 'talents.json')
  const talents = Array.from({ length: 22 }, (_, index) => ({ id: `test-${index}`, name: `Talent testowy ${index + 1}`, flavorDescription: '', description: '**Opis testowy** z polskimi znakami: żółć.', usesPerMission: index % 4, group: 'Test eksportu', subgroup: 'Wybrane', code: null, isDarkGift: index % 2 === 0, isAction: false, oncePerScene: index % 2 !== 0 }))
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, talents: [...talents, { ...talents[0], id: 'outside', subgroup: 'Poza eksportem' }] }))
  const before = fs.readFileSync(file, 'utf8')
  const app = express()
  const renderer = installTalentTemplates(app, { file: path.join(root, 'template.json') })
  installTalents(app, file, renderer)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (body) => fetch(`${base}/api/talents/export-pdf`, { method: 'POST', body: JSON.stringify(body) })
  let browser
  try {
    const library = await (await fetch(`${base}/api/talents`)).json()
    assert.equal((await post({ group: 'Brak', subgroup: '', revision: library.revision })).status, 400)
    assert.equal((await post({ group: 'Test eksportu', subgroup: '', revision: 'stara' })).status, 400)
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    await page.route('**/api/talents**', async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({ url: base + url.pathname + url.search, timeout: 120000 })
      await route.fulfill({ response })
    })
    await page.goto('http://localhost:8080/#dev-talents')
    const exportButton = page.getByRole('button', { name: 'Eksportuj PDF A4', exact: true })
    await page.getByLabel('Nazwa talentu', { exact: true }).waitFor()
    assert.ok(await exportButton.isDisabled())
    await page.locator('.talent-filters select').nth(0).selectOption('Test eksportu')
    await page.locator('.talent-filters select').nth(1).selectOption('Wybrane')
    await page.getByRole('searchbox').fill('Nazwa nieobecna w bibliotece')
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
    await exportButton.click()
    const download = await downloadPromise
    const destination = path.join(root, 'sheet.pdf')
    await download.saveAs(destination)
    const document = await PDFDocument.load(fs.readFileSync(destination))
    assert.equal(document.getPageCount(), 2)
    for (const [index, sheet] of document.getPages().entries()) {
      assert.ok(Math.abs(sheet.getWidth() - PageSizes.A4[0]) < .01)
      assert.ok(Math.abs(sheet.getHeight() - PageSizes.A4[1]) < .01)
      const objects = sheet.node.Resources().lookup(PDFName.of('XObject'))
      assert.equal(objects.keys().length, index === 0 ? 21 : 1)
    }
    assert.equal(fs.readFileSync(file, 'utf8'), before)
    console.log('OK: pobieranie PDF z UI, wybór grupy/podgrupy, wyszukiwanie nie ogranicza eksportu, A4, 21+1 kart na stronach, brak zmian biblioteki, kontrola rewizji i pustego wyboru.')
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
