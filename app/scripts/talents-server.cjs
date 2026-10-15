const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const XLSX = require('xlsx')

const CODE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/
const normalize = (value) => value.trim().normalize('NFC').toLocaleLowerCase('pl')
const key = (talent) => JSON.stringify([talent.group, talent.subgroup ?? '', talent.name].map(normalize))
function text(value, label, max = 20000, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Nieprawidłowe pole: ${label}.`)
  return value.trim()
}
function validateTalent(value, requireId = true) {
  if (!value || typeof value !== 'object') throw new Error('Nieprawidłowy talent.')
  if (!Number.isInteger(value.usesPerMission) || value.usesPerMission < 0 || value.usesPerMission > 3) throw new Error('Liczba użyć musi być liczbą całkowitą od 0 do 3.')
  if (value.code !== null && (typeof value.code !== 'string' || !CODE.test(value.code))) throw new Error('Nieprawidłowy kod talentu.')
  if (value.isDarkGift !== undefined && typeof value.isDarkGift !== 'boolean') throw new Error('Flaga Daru Ciemności musi mieć wartość tak lub nie.')
  return {
    ...(requireId ? { id: text(value.id, 'ID', 100, true) } : {}),
    name: text(value.name, 'nazwa', 300, true),
    flavorDescription: text(value.flavorDescription, 'opis fabularny'),
    description: text(value.description, 'opis działania', 20000, true),
    usesPerMission: value.usesPerMission,
    group: text(value.group, 'grupa', 200, true),
    subgroup: value.subgroup === null ? null : text(value.subgroup, 'podgrupa', 200) || null,
    code: value.code,
    isDarkGift: value.isDarkGift ?? false,
  }
}
function validateLibrary(library) {
  if (library?.schemaVersion !== 1 || !Array.isArray(library.talents) || library.talents.length > 10000) throw new Error('Nieprawidłowa lista talentów.')
  const ids = new Set(), codes = new Set(), keys = new Set()
  const talents = library.talents.map((item) => {
    const talent = validateTalent(item)
    if (ids.has(talent.id) || keys.has(key(talent)) || (talent.code && codes.has(talent.code))) throw new Error('Powtórzone ID, kod lub nazwa w tej samej grupie i podgrupie.')
    ids.add(talent.id); keys.add(key(talent)); if (talent.code) codes.add(talent.code)
    return talent
  })
  return { schemaVersion: 1, talents }
}
function parseWorkbook(buffer, group, subgroup) {
  // Accept real OLE XLS and ZIP XLSX, not HTML/CSV masquerading as spreadsheets.
  if (!(buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) || buffer.subarray(0, 2).toString() === 'PK')) throw new Error('Wybierz plik XLS lub XLSX.')
  const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: 10002, cellFormula: true })
  if (workbook.SheetNames.length !== 1) throw new Error('Plik musi zawierać jeden arkusz z talentami.')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet['!ref']) throw new Error('Arkusz jest pusty.')
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
  if (range.e.r > 10000 || range.e.c > 4) throw new Error('Dozwolone jest pięć kolumn i maksymalnie 10000 talentów.')
  for (const [address, cell] of Object.entries(sheet)) {
    if (!address.startsWith('!') && (cell.f || cell.t === 'e')) throw new Error(`Komórka ${address}: usuń formułę lub błąd arkusza.`)
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true })
  const expected = [['nazwa talentu'], ['opis fabularny', 'opis fabularny talentu'], ['opis talentu'], ['ile razy można użyć', 'ilość użyć na misję'], ['kod', 'unikalny identyfikator']]
  if (rows[0]?.length !== 5 || expected.some((names, index) => !names.includes(normalize(String(rows[0][index]))))) throw new Error('Nagłówki: Nazwa talentu, Opis fabularny, Opis talentu, Ile razy można użyć, Kod.')
  const talents = []
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index]
    if (row.every((cell) => cell === '')) continue
    try {
      if (row[3] === '' || !/^[0-3]$/.test(String(row[3]))) throw new Error('Podaj liczbę użyć od 0 do 3.')
      talents.push(validateTalent({ name: row[0], flavorDescription: row[1], description: row[2], usesPerMission: Number(row[3]), group, subgroup: subgroup || null, code: row[4] === '' ? null : row[4] }, false))
    } catch (error) { throw new Error(`Wiersz ${index + 1}: ${error.message}`) }
  }
  if (!talents.length) throw new Error('Brak talentów do importu.')
  return talents
}
function planImport(library, incoming) {
  if (!Array.isArray(incoming) || !incoming.length || incoming.length > 10000) throw new Error('Nieprawidłowa lista importu.')
  const used = new Set(), keys = new Set(), codes = new Set()
  return incoming.map((item, index) => {
    const talent = validateTalent(item, false)
    if (keys.has(key(talent)) || (talent.code && codes.has(talent.code))) throw new Error(`Powtórzony talent lub kod w imporcie, pozycja ${index + 1}.`)
    keys.add(key(talent)); if (talent.code) codes.add(talent.code)
    const byCode = talent.code ? library.talents.find((t) => t.code === talent.code) : undefined
    const byName = library.talents.find((t) => key(t) === key(talent))
    if (byCode && byName && byCode.id !== byName.id) throw new Error('Kod i nazwa wskazują różne istniejące talenty.')
    const existing = byCode || byName
    if (existing && used.has(existing.id)) throw new Error('Kilka wierszy wskazuje ten sam istniejący talent.')
    if (existing) used.add(existing.id)
    if (existing?.code && talent.code && existing.code !== talent.code) throw new Error('Import nie może zmienić nadanego kodu talentu.')
    const next = { ...talent, id: existing?.id || randomUUID(), code: existing?.code || talent.code, isDarkGift: existing?.isDarkGift ?? talent.isDarkGift }
    const action = !existing ? 'add' : JSON.stringify(validateTalent(existing)) === JSON.stringify(validateTalent(next)) ? 'unchanged' : 'update'
    return { talent: next, action }
  })
}
async function body(request) {
  const chunks = []; let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) throw new Error('Plik lub żądanie przekracza 8 MB.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
function installTalents(app, file = '/cardTemplates/talenty/talenty.json') {
  function load() {
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : JSON.stringify({ schemaVersion: 1, talents: [] })
    return { ...validateLibrary(JSON.parse(content)), revision: createHash('sha256').update(content).digest('hex') }
  }
  function save(library, revision) {
    const current = load()
    if (current.revision !== revision) { const error = new Error('Lista zmieniła się od jej wczytania. Odśwież dane i spróbuj ponownie.'); error.status = 409; throw error }
    const validated = validateLibrary(library)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
    const temp = `${file}.tmp`
    fs.writeFileSync(temp, `${JSON.stringify(validated, null, 2)}\n`, 'utf8')
    fs.renameSync(temp, file)
    return load()
  }
  const route = (handler) => async (request, response) => {
    try { response.json(await handler(request)) } catch (error) { response.status(error.status || 400).json({ error: error.message || 'Nie udało się obsłużyć talentów.' }) }
  }
  app.get('/api/talents', route(() => load()))
  app.post('/api/talents/save', route(async (request) => {
    const input = JSON.parse((await body(request)).toString('utf8'))
    const current = load()
    const edited = validateTalent(input.talent)
    const existing = current.talents.find((t) => t.id === edited.id)
    if (!existing) throw new Error('Nie znaleziono talentu.')
    if (edited.code !== existing.code) throw new Error('Nie można zmieniać kodu w edytorze tekstowym.')
    return save({ schemaVersion: 1, talents: current.talents.map((t) => t.id === edited.id ? edited : t) }, input.revision)
  }))
  app.post('/api/talents/import-preview', route(async (request) => {
    const url = new URL(request.url, 'http://localhost')
    const incoming = parseWorkbook(await body(request), url.searchParams.get('group') || '', url.searchParams.get('subgroup') || null)
    const current = load()
    return { revision: current.revision, rows: planImport(current, incoming) }
  }))
  app.post('/api/talents/import', route(async (request) => {
    const input = JSON.parse((await body(request)).toString('utf8'))
    const current = load()
    const plan = planImport(current, input.talents)
    const replacements = new Map(plan.map((row) => [row.talent.id, row.talent]))
    const talents = current.talents.map((t) => replacements.get(t.id) || t)
    talents.push(...plan.filter((r) => r.action === 'add').map((r) => r.talent))
    return save({ schemaVersion: 1, talents }, input.revision)
  }))
}
module.exports = { installTalents, validateLibrary, parseWorkbook, planImport }
