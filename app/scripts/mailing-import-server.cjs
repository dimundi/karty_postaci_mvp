const { createHash, randomUUID } = require('node:crypto')

const revision = (list) => createHash('sha256').update(JSON.stringify(list)).digest('hex')

function parseCsv(bytes) {
  let encoding = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  let text
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) }
  catch { throw new Error('Niepoprawne kodowanie CSV. Zapisz plik jako UTF-8 lub UTF-16 z BOM.') }
  const rows = []
  let row = [], field = '', quoted = false, closed = false
  const pushField = () => { row.push(field); field = ''; closed = false }
  const pushRow = () => { pushField(); if (row.some((v) => v.trim())) rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closed = true }
      } else field += c
    } else if (c === ',') pushField()
    else if (c === '\r' || c === '\n') { pushRow(); if (c === '\r' && text[i + 1] === '\n') i++ }
    else if (c === '"' && !field && !closed) quoted = true
    else {
      if (closed || c === '"') throw new Error('Niepoprawne cudzysłowy w CSV.')
      field += c
    }
  }
  if (quoted) throw new Error('Niezamknięty cudzysłów w CSV.')
  if (field || row.length || closed) pushRow()
  if (rows.length < 2) throw new Error('Plik CSV nie zawiera rekordów danych.')
  const header = rows.shift().map((v) => v.trim())
  if (header.filter((v) => v === 'order').length !== 1 || header.filter((v) => v === 'email').length !== 1) throw new Error('CSV musi mieć pojedyncze kolumny order i email.')
  if (rows.length > 20000) throw new Error('Plik może zawierać najwyżej 20 000 rekordów.')
  return rows.map((row, index) => ({ sourceRow: index + 1, orderId: row[header.indexOf('order')] ?? '', email: row[header.indexOf('email')] ?? '', malformed: row.length !== header.length }))
}

function nextSequence(list) {
  const used = new Set(list.recipients.map((r) => r.sequenceNumber))
  let number = Math.max(0, ...list.recipients.filter((r) => r.orderId !== 'TEST').map((r) => r.sequenceNumber || 0))
  return () => { do { number++ } while (used.has(number)); if (!Number.isSafeInteger(number)) throw new Error('Wyczerpano zakres numerów.'); used.add(number); return number }
}

function prepareImport(records, list, normalizeEmail) {
  const emails = new Map(list.recipients.map((r) => [r.email, r]))
  const orders = new Map(list.recipients.filter((r) => r.orderId && r.orderId !== 'TEST').map((r) => [r.orderId, r]))
  const allocate = nextSequence(list)
  const rows = records.map((record) => {
    const row = { sourceRow: record.sourceRow, orderId: record.orderId.trim(), email: record.email, action: 'error', reason: '', sequenceNumber: null }
    try {
      if (record.malformed) throw new Error('Liczba kolumn nie zgadza się z nagłówkiem.')
      if (!row.orderId || row.orderId.length > 200 || /[\x00-\x1f\x7f]/.test(row.orderId)) throw new Error('Nieprawidłowy lub pusty numer zamówienia.')
      row.email = normalizeEmail(row.email)
      const emailEntry = emails.get(row.email), orderEntry = orders.get(row.orderId)
      if (emailEntry && emailEntry.orderId !== row.orderId) throw new Error('Adres e-mail występuje przy innym zamówieniu.')
      if (row.orderId !== 'TEST' && orderEntry && orderEntry.email !== row.email) throw new Error('Zamówienie występuje przy innym adresie e-mail.')
      if (emailEntry) { row.action = 'skip'; row.reason = 'Para zamówienie–e-mail już istnieje lub powtarza się w pliku.'; row.sequenceNumber = emailEntry.sequenceNumber ?? null }
      else {
        row.action = 'add'; row.sequenceNumber = allocate()
        emails.set(row.email, row)
        if (row.orderId !== 'TEST') orders.set(row.orderId, row)
      }
    } catch (error) { row.reason = error.message }
    return row
  })
  return { revision: revision(list), rows, added: rows.filter((r) => r.action === 'add').length, skipped: rows.filter((r) => r.action === 'skip').length, errors: rows.filter((r) => r.action === 'error').length }
}

function installMailingImport(app, { read, save, endpoint, readBody, normalizeEmail }) {
  // Podglądy są prywatne, tymczasowe i nie zmieniają listy odbiorców.
  const drafts = new Map()
  app.post('/api/mailing-list/import-preview', endpoint(async (request) => {
    const chunks = []; let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 5 * 1024 * 1024) throw new Error('Plik CSV może mieć najwyżej 5 MB.')
      chunks.push(chunk)
    }
    const records = parseCsv(Buffer.concat(chunks))
    const preview = prepareImport(records, read(), normalizeEmail)
    const now = Date.now()
    for (const [id, draft] of drafts) if (draft.expiresAt < now) drafts.delete(id)
    while (drafts.size >= 10) drafts.delete(drafts.keys().next().value)
    const draftId = randomUUID()
    drafts.set(draftId, { preview, expiresAt: now + 30 * 60 * 1000 })
    return { ...preview, draftId }
  }))
  app.post('/api/mailing-list/import', endpoint(async (request) => {
    const input = await readBody(request)
    const draft = drafts.get(input?.draftId)
    if (!draft || draft.expiresAt < Date.now()) throw new Error('Podgląd wygasł. Przygotuj go ponownie.')
    const list = read()
    if (revision(list) !== draft.preview.revision) { const error = new Error('Lista zmieniła się. Przygotuj nowy podgląd importu.'); error.status = 409; throw error }
    if (draft.preview.errors) throw new Error('Popraw błędy w pliku przed importem.')
    const createdAt = new Date().toISOString()
    for (const row of draft.preview.rows.filter((r) => r.action === 'add')) list.recipients.push({ id: randomUUID(), email: row.email, orderId: row.orderId, sequenceNumber: row.sequenceNumber, createdAt, deliveryStatus: 'not_sent', talentId: null })
    if (draft.preview.added) save(list)
    drafts.delete(input.draftId)
    return { list, added: draft.preview.added, skipped: draft.preview.skipped }
  }))
}

module.exports = { parseCsv, prepareImport, nextSequence, revision, installMailingImport }
