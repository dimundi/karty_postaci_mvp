const fs = require('node:fs')
const path = require('node:path')
const nodemailer = require('nodemailer')

function smtpConfig(root) {
  let value
  try { value = JSON.parse(fs.readFileSync(path.join(root, 'smtp.json'), 'utf8').replace(/^\uFEFF/, '')) }
  catch { throw new Error('Nie udało się odczytać konfiguracji SMTP.') }
  const { normalizeEmail } = require('./mailing-list-server.cjs')
  if (typeof value.host !== 'string' || !value.host.trim() || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !['tls', 'starttls'].includes(value.encryption) || typeof value.auth?.user !== 'string' || !value.auth.user || typeof value.auth?.pass !== 'string' || !value.auth.pass || typeof value.from?.name !== 'string') throw new Error('Uzupełnij host, port, szyfrowanie, login, hasło i nadawcę w smtp.json.')
  try { normalizeEmail(value.from.email); normalizeEmail(value.bcc) } catch { throw new Error('Sprawdź adres nadawcy i BCC w smtp.json.') }
  return value
}
function installMailingSend(app, { root, read, save, talentsFile = '/cardTemplates/talenty/talenty.json', endpoint, readBody, createTransport = nodemailer.createTransport }) {
  const active = new Set()
  app.post('/api/mailing-list/preview-send', endpoint(async (request) => {
    const { draftId } = await readBody(request)
    if (typeof draftId !== 'string' || !/^[a-f0-9-]{36}$/.test(draftId)) throw new Error('Najpierw przygotuj podgląd wiadomości.')
    const directory = path.join(root, 'messages', draftId)
    let draft
    try { draft = JSON.parse(fs.readFileSync(path.join(directory, 'message.json'), 'utf8')) }
    catch { throw new Error('Nie znaleziono podglądu wiadomości. Przygotuj go ponownie.') }
    if (typeof draft.code !== 'string' || !/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(draft.code)) throw new Error('Ten podgląd nie ma wygenerowanego kodu. Przygotuj nowy podgląd.')
    const list = read()
    const recipient = list.recipients.find((r) => r.id === draft.recipientId)
    if (draft.status !== 'preview' || !recipient || recipient.email !== draft.to || ['sent', 'sending'].includes(recipient.deliveryStatus)) throw new Error('Odbiorca lub jego przypisanie uległy zmianie. Odśwież listę.')
    if (recipient.talentId && (recipient.talentId !== draft.talent.id || recipient.code !== draft.code || recipient.draftId !== draft.id)) throw new Error('Odbiorca ma już przypisaną inną nagrodę. Otwórz jego zapisany podgląd.')
    if (list.recipients.some((r) => r.id !== recipient.id && (r.talentId === draft.talent.id || r.code === draft.code))) throw new Error('Talent lub kod został już przypisany innemu odbiorcy. Przygotuj nowy podgląd.')
    const { validateLibrary, validateTalent } = require('./talents-server.cjs')
    const library = validateLibrary(JSON.parse(fs.readFileSync(talentsFile, 'utf8').replace(/^\uFEFF/, '')))
    const talent = library.talents.find((t) => t.id === draft.talent.id)
    const { isMailingTalent } = require('./mailing-talent-pool.cjs')
    if (!talent || !isMailingTalent(talent) || (talent.code && (talent.code !== draft.code || !recipient.talentId)) || library.talents.some((t) => t.id !== talent.id && t.code === draft.code)) throw new Error('Talent lub kod nie jest dostępny do wysyłki.')
    if (JSON.stringify({ ...talent, code: null }) !== JSON.stringify({ ...validateTalent(draft.talent), code: null })) throw new Error('Talent zmienił się od przygotowania podglądu. Przygotuj nowy podgląd.')
    const config = smtpConfig(root)
    if (config.bcc !== draft.bcc) throw new Error('Adres BCC zmienił się od przygotowania podglądu. Przygotuj nowy podgląd.')
    if (active.has(recipient.id)) throw new Error('Trwa już wysyłka do tego odbiorcy.')
    const html = fs.readFileSync(path.join(directory, 'email.html'), 'utf8')
    const attachments = [
      { filename: 'talent.pdf', content: fs.readFileSync(path.join(directory, 'talent.pdf')), contentType: 'application/pdf' },
      { filename: 'moj-talent-klanarchia.png', content: fs.readFileSync(path.join(directory, 'facebook.png')), contentType: 'image/png' },
    ]
    // Lista jest trwałym rejestrem rezerwacji. Zapisujemy ją przed biblioteką i SMTP.
    Object.assign(recipient, { talentId: talent.id, code: draft.code, draftId: draft.id, deliveryStatus: 'sending', lastAttemptAt: new Date().toISOString(), deliveryError: null })
    save(list)
    function updateRecipient(values) {
      const current = read()
      const entry = current.recipients.find((r) => r.id === recipient.id)
      if (!entry || entry.draftId !== draft.id) throw new Error('Nie można zapisać wyniku wysyłki. Sprawdź listę mailingową.')
      Object.assign(entry, values)
      save(current)
    }
    active.add(recipient.id)
    let transport
    let smtpAccepted = false
    try {
      talent.code = draft.code
      fs.copyFileSync(talentsFile, `${talentsFile}.bak`)
      fs.writeFileSync(`${talentsFile}.tmp`, `${JSON.stringify(library, null, 2)}\n`)
      fs.renameSync(`${talentsFile}.tmp`, talentsFile)
      transport = createTransport({ host: config.host.trim(), port: config.port, secure: config.encryption === 'tls', requireTLS: config.encryption === 'starttls', auth: { user: config.auth.user, pass: config.auth.pass }, connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 60000, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true })
      const info = await transport.sendMail({ from: { name: config.from.name, address: config.from.email }, to: draft.to, bcc: draft.bcc, subject: draft.subject, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), attachments })
      if (!info.accepted?.some((email) => String(email).toLowerCase() === draft.to.toLowerCase())) throw new Error('SMTP_REJECTED')
      smtpAccepted = true
      updateRecipient({ deliveryStatus: 'sent', sentAt: new Date().toISOString(), messageId: info.messageId || null, deliveryError: null, bccRejected: Boolean(info.rejected?.length) })
      return { accepted: true, partial: Boolean(info.rejected?.length), message: info.rejected?.length ? 'Wysłano do odbiorcy i zapisano kod. SMTP odrzucił kopię BCC.' : 'Wysłano. Zapisano przypisanie talentu i kod.' }
    } catch (error) {
      if (smtpAccepted) throw new Error('SMTP przyjął wiadomość, ale zapis statusu nie powiódł się. Nie ponawiaj wysyłki. Sprawdź skrzynkę i plik listy mailingowej.')
      const descriptions = { EAUTH: 'Serwer odrzucił logowanie. Sprawdź dane SMTP.', ECONNECTION: 'Nie udało się połączyć z SMTP.', ETIMEDOUT: 'Przekroczono czas oczekiwania. Sprawdź skrzynki przed ponowną próbą.', ESOCKET: 'Błąd połączenia lub szyfrowania SMTP.', EENVELOPE: 'Serwer odrzucił adres nadawcy lub odbiorcy.' }
      const message = descriptions[error.code] || 'SMTP nie potwierdził wysyłki. Sprawdź skrzynki przed ponowną próbą.'
      updateRecipient({ deliveryStatus: 'error', deliveryError: message })
      throw new Error(message)
    } finally { transport?.close(); active.delete(recipient.id) }
  }))
}
module.exports = { installMailingSend, smtpConfig }
