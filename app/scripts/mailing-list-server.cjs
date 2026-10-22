const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { domainToASCII } = require('node:url')

function normalizeEmail(value) {
  if (typeof value !== 'string') throw new Error('Podaj poprawny adres e-mail.')
  const email = value.trim()
  const parts = email.split('@')
  if (parts.length !== 2 || /\s/.test(email)) throw new Error('Podaj poprawny adres e-mail.')
  const local = parts[0].toLowerCase()
  const domain = domainToASCII(parts[1]).toLowerCase()
  if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain.includes('.') || domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || local.length + domain.length + 1 > 254) throw new Error('Podaj poprawny adres e-mail.')
  return `${local}@${domain}`
}

function validateList(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.recipients)) throw new Error('Nieprawidłowy format listy mailingowej.')
  const ids = new Set(), emails = new Set(), orders = new Set(), numbers = new Set(), talentIds = new Set(), codes = new Set()
  for (const entry of value.recipients) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || normalizeEmail(entry.email) !== entry.email || emails.has(entry.email) || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('Nieprawidłowy lub powtórzony wpis na liście mailingowej.')
    if (entry.deliveryStatus !== undefined && !['not_sent', 'sending', 'sent', 'error'].includes(entry.deliveryStatus)) throw new Error('Nieprawidłowy status wysyłki.')
    if (entry.talentId != null && (typeof entry.talentId !== 'string' || !entry.talentId.trim() || entry.talentId.length > 100)) throw new Error('Nieprawidłowe ID talentu.')
    if (entry.talentId && talentIds.has(entry.talentId)) throw new Error('Talent przypisano więcej niż jednemu odbiorcy.')
    if (entry.code != null && (typeof entry.code !== 'string' || !/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(entry.code) || codes.has(entry.code))) throw new Error('Nieprawidłowy lub powtórzony kod nagrody.')
    if (entry.talentId) talentIds.add(entry.talentId)
    if (entry.code) codes.add(entry.code)
    if (entry.orderId !== undefined && (typeof entry.orderId !== 'string' || !entry.orderId.trim() || entry.orderId !== entry.orderId.trim() || entry.orderId.length > 200 || /[\x00-\x1f\x7f]/.test(entry.orderId))) throw new Error('Nieprawidłowy numer zamówienia.')
    if (entry.orderId && entry.orderId !== 'TEST' && orders.has(entry.orderId)) throw new Error('Powtórzony numer zamówienia.')
    if (entry.sequenceNumber !== undefined && (!Number.isSafeInteger(entry.sequenceNumber) || entry.sequenceNumber < 1 || numbers.has(entry.sequenceNumber))) throw new Error('Nieprawidłowy lub powtórzony numer kolejny.')
    if (entry.orderId !== 'TEST') orders.add(entry.orderId)
    numbers.add(entry.sequenceNumber)
    ids.add(entry.id); emails.add(entry.email)
  }
  return { ...value, recipients: value.recipients.map((entry) => ({ ...entry, deliveryStatus: entry.deliveryStatus ?? 'not_sent', talentId: entry.talentId ?? null })) }
}

async function readBody(request) {
  let bytes = 0
  const chunks = []
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 2048) throw new Error('Żądanie jest zbyt duże.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Nieprawidłowe dane adresu e-mail.') }
}

function installMailingList(app, file = '/privateData/mailing-list.json', renderer) {
  function save(list) {
    validateList(list)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
    fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(list, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(`${file}.tmp`, file)
  }
  function read() {
    if (!fs.existsSync(file)) return { schemaVersion: 1, recipients: [] }
    try { return validateList(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))) }
    catch { const error = new Error('Nie udało się odczytać listy mailingowej. Sprawdź jej plik JSON.'); error.status = 500; throw error }
  }
  const endpoint = (handler) => async (request, response) => {
    response.set('Cache-Control', 'no-store')
    try { response.json(await handler(request)) }
    catch (error) { response.status(error.status || 400).json({ error: error.message || 'Nie udało się obsłużyć listy mailingowej.' }) }
  }
  app.get('/api/mailing-list', endpoint(() => read()))
  require('./mailing-import-server.cjs').installMailingImport(app, { read, save, endpoint, readBody, normalizeEmail })
  app.post('/api/mailing-list/edit', endpoint(async (request) => {
    const input = await readBody(request)
    const list = read()
    const entry = list.recipients.find((r) => r.id === input?.id)
    if (!entry) throw new Error('Nie znaleziono wpisu.')
    if (input.originalEmail !== entry.email) { const error = new Error('Adres zmienił się. Odśwież listę przed edycją.'); error.status = 409; throw error }
    if (entry.deliveryStatus === 'sending' || entry.deliveryStatus === 'sent') throw new Error('Nie można zmieniać adresu w trakcie ani po wysyłce.')
    if (entry.talentId) throw new Error('Nie można zmieniać adresu z przypisaną nagrodą.')
    const email = normalizeEmail(input.email)
    if (list.recipients.some((r) => r.id !== entry.id && r.email === email)) throw new Error('Ten adres jest już na liście mailingowej.')
    entry.email = email
    save(list)
    return list
  }))
  require('./mailing-preview-server.cjs').installMailingPreview(app, { file, read, save, renderer, endpoint, readBody })
  app.post('/api/mailing-list/send', endpoint(async (request) => {
    const input = await readBody(request)
    const recipient = read().recipients.find((entry) => entry.id === input?.recipientId)
    if (!recipient) { const error = new Error('Nie znaleziono adresu na liście mailingowej.'); error.status = 404; throw error }
    if (recipient.deliveryStatus === 'sent') { const error = new Error('Wiadomość do tego odbiorcy została już wysłana.'); error.status = 409; throw error }
    const error = new Error('Wysyłka nie jest jeszcze skonfigurowana. Najpierw trzeba ustawić serwer SMTP.')
    error.status = 503
    throw error
  }))
  app.post('/api/mailing-list', endpoint(async (request) => {
    const input = await readBody(request)
    const email = normalizeEmail(input?.email)
    const list = read()
    if (list.recipients.some((entry) => entry.email === email)) { const error = new Error('Ten adres jest już na liście mailingowej.'); error.status = 409; throw error }
    const recipient = { id: randomUUID(), email, orderId: 'TEST', sequenceNumber: Math.max(899, ...list.recipients.map((r) => r.sequenceNumber || 0)) + 1, createdAt: new Date().toISOString(), deliveryStatus: 'not_sent', talentId: null }
    list.recipients.push(recipient)
    save(list)
    return list
  }))
}
module.exports = { installMailingList, normalizeEmail, validateList }
