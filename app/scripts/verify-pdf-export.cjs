const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { PDFDocument, PDFName } = require('pdf-lib')
const fontkit = require('@pdf-lib/fontkit')

// Uruchamiamy rzeczywisty eksport, zastępując wyłącznie API przeglądarki.
const filename = path.resolve('src/user/exportCharacterPdf.ts')
const source = fs.readFileSync(filename, 'utf8')
  .replace(/import formFontUrl[^\n]+/, "const formFontUrl = '/src/assets/fonts/NotoSans-Regular.ttf'")
  .replace(/import checkedV[^\n]+/, "const checkedV = '/src/assets/checked_v.svg'")
  .replace(/import checkedX[^\n]+/, "const checkedX = '/src/assets/checked_x.svg'")
  .replace(/import \{ templateUrl \}[^\n]+/, 'const templateUrl = (value: string) => `/templates/${value}`')
const compiled = new Module(filename, module)
compiled.filename = filename
compiled.paths = Module._nodeModulePaths(path.dirname(filename))
compiled._compile(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
let exportedBlob
global.fetch = async (url) => {
  const file = url.startsWith('/templates/')
    ? path.join('/pdfTemplates', decodeURIComponent(url.slice('/templates/'.length)))
    : path.join(process.cwd(), url.slice(1))
  return new Response(fs.readFileSync(file))
}
global.Image = class {
  set src(value) { queueMicrotask(() => this.onload()) }
}
global.DOMParser = class {
  parseFromString(svg) {
    return { querySelector: () => ({ getAttribute: () => svg.match(/<path\b[^>]*\bd="([^"]+)"/)[1] }) }
  }
}
const context = new Proxy({}, { get: () => () => {} })
global.document = {
  body: { appendChild() {} },
  createElement: (tag) => tag === 'canvas'
    ? { getContext: () => context, toBlob: (callback) => callback(new Blob([png])) }
    : { click() {}, remove() {} },
}
URL.createObjectURL = (blob) => { exportedBlob = blob; return 'blob:test' }
URL.revokeObjectURL = () => {}

async function verify() {
  const files = fs.readdirSync('/pdfTemplates/klany').filter((file) => file.endsWith('.json'))
  assert.ok(files.length > 0)
  const archetypes = fs.readdirSync('/pdfTemplates/archetypy')
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => JSON.parse(fs.readFileSync(path.join('/pdfTemplates/archetypy', file), 'utf8')))
  assert.ok(archetypes.length > 0)
  for (const archetype of archetypes) {
  for (const file of files) {
    const config = JSON.parse(fs.readFileSync(path.join('/pdfTemplates/klany', file), 'utf8'))
    const checkboxes = config.fields.filter((field) => field.type === 'talent' || field.type === 'factionAspect')
    const checkedFields = Object.fromEntries(checkboxes.map((field, index) => [field.id, index % 2 === 0]))
    await compiled.exports.exportCharacterPdf({
      clan: { ...config, checkedFields, counters: { heat: 1, darkInstinct: 2 }, texts: {} },
      archetype: { ...archetype, characterName: 'Łucja Żółć', clanName: 'Straż Źródeł' },
    })
    const pdf = await PDFDocument.load(await exportedBlob.arrayBuffer())
    assert.equal(pdf.getPageCount(), 2)
    assert.equal(pdf.getForm().getFields().length, checkboxes.length + archetype.fields.length)
    pdf.registerFontkit(fontkit)
    const font = await pdf.embedFont(fs.readFileSync('src/assets/fonts/NotoSans-Regular.ttf'), { subset: false })
    for (const field of archetype.fields) {
      const textField = pdf.getForm().getTextField(`archetype.${field.id}`)
      assert.equal(textField.getText(), field.type === 'clanName' ? 'Straż Źródeł' : 'Łucja Żółć')
      assert.equal(textField.isReadOnly(), false)
      assert.equal(textField.isMultiline(), false)
      const rectangle = textField.acroField.getWidgets()[0].getRectangle()
      const expectedRectangle = {
        x: field.x, y: pdf.getPage(1).getHeight() - field.y - field.height,
        width: field.width, height: field.height,
      }
      for (const key of Object.keys(expectedRectangle)) {
        assert.ok(Math.abs(rectangle[key] - expectedRectangle[key]) < 0.000001)
      }
      assert.ok(pdf.getForm().acroForm.dict.lookup(PDFName.of('DR')))
      textField.setText('Zażółć gęślą jaźń')
      textField.updateAppearances(font)
    }
    for (const field of checkboxes) {
      const checkbox = pdf.getForm().getCheckBox(`${field.type}.${field.id}`)
      assert.equal(checkbox.isChecked(), checkedFields[field.id])
      assert.equal(checkbox.isReadOnly(), false)
      const widget = checkbox.acroField.getWidgets()[0]
      assert.deepEqual(widget.getRectangle(), {
        x: field.x, y: pdf.getPage(0).getHeight() - field.y - field.height,
        width: field.width, height: field.height,
      })
      assert.ok(widget.getAppearances().normal)
      if (checkbox.isChecked()) checkbox.uncheck()
      else checkbox.check()
    }
    const changed = await PDFDocument.load(await pdf.save())
    for (const field of checkboxes) {
      assert.equal(changed.getForm().getCheckBox(`${field.type}.${field.id}`).isChecked(), !checkedFields[field.id])
    }
    for (const field of archetype.fields) {
      assert.equal(changed.getForm().getTextField(`archetype.${field.id}`).getText(), 'Zażółć gęślą jaźń')
    }
    console.log(`${file} + ${archetype.templateFile}: poprawne pola, polskie znaki i zapis zmian`)
  }
  }
}
verify().catch((error) => { console.error(error); process.exitCode = 1 })
