const fs = require('node:fs')
const path = require('node:path')
const { randomUUID, randomInt } = require('node:crypto')
const { validateLibrary } = require('./talents-server.cjs')
const { renderMailingFooter } = require('./mailing-email-footer.cjs')
const { MAILING_GROUP, MAILING_SUBGROUP, isMailingTalent } = require('./mailing-talent-pool.cjs')

function installMailingPreview(app, { file, read, save, renderer, endpoint, readBody, talentsFile = '/cardTemplates/talenty/talenty.json' }) {
  const root = path.dirname(file)
  const messages = path.join(root, 'messages')
  require('./mailing-send-server.cjs').installMailingSend(app, { root, read, save, talentsFile, endpoint, readBody })
  const library = () => validateLibrary(JSON.parse(fs.readFileSync(talentsFile, 'utf8').replace(/^\uFEFF/, ''))).talents
  function generateCode() {
    const used = new Set(library().map((t) => t.code).filter(Boolean))
    for (const recipient of read().recipients) if (recipient.code) used.add(recipient.code)
    if (fs.existsSync(messages)) for (const entry of fs.readdirSync(messages, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue
      const saved = path.join(messages, entry.name, 'message.json')
      if (fs.existsSync(saved)) {
        const draft = JSON.parse(fs.readFileSync(saved, 'utf8'))
        if (draft.code) used.add(draft.code)
      }
    }
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code
    do {
      const chars = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
      code = `${chars.slice(0, 4)}-${chars.slice(4)}`
    } while (used.has(code))
    return code
  }
  const free = () => {
    const used = new Set(read().recipients.map((r) => r.talentId).filter(Boolean))
    return library().filter((t) => isMailingTalent(t) && !t.code && !used.has(t.id))
  }
  app.get('/api/mailing-list/preview-options', endpoint(() => {
    const talents = free()
    return { groups: [MAILING_GROUP], selectedGroups: [MAILING_GROUP], subgroup: MAILING_SUBGROUP, talents: talents.map(({ id, name, group, subgroup }) => ({ id, name, group, subgroup })) }
  }))
  app.post('/api/mailing-list/preview-selection', endpoint(async (request) => {
    const { groups } = await readBody(request)
    if (!Array.isArray(groups) || groups.length !== 1 || groups[0] !== MAILING_GROUP) throw new Error('Mailing korzysta wyłącznie z Dary Ciemności / Ekskluzywne.')
    return { groups: [MAILING_GROUP] }
  }))
  app.post('/api/mailing-list/preview', endpoint(async (request) => {
    const input = await readBody(request)
    const recipient = read().recipients.find((r) => r.id === input.recipientId)
    if (!recipient || recipient.deliveryStatus === 'sent' || recipient.deliveryStatus === 'sending') throw new Error('Odbiorca nie jest dostępny do nowego podglądu.')
    if (recipient.talentId) {
      if (!/^[a-f0-9-]{36}$/.test(recipient.draftId || '')) throw new Error('Brak zapisanego podglądu przypisanej nagrody.')
      const saved = JSON.parse(fs.readFileSync(path.join(messages, recipient.draftId, 'message.json'), 'utf8'))
      if (saved.recipientId !== recipient.id || saved.to !== recipient.email || saved.code !== recipient.code || saved.talent.id !== recipient.talentId) throw new Error('Zapisany podgląd nie zgadza się z przypisaniem odbiorcy.')
      return saved
    }
    if (!Number.isSafeInteger(recipient.sequenceNumber) || recipient.sequenceNumber < 1) throw new Error('Odbiorca nie ma poprawnego numeru kolejnego. Uzupełnij go przed przygotowaniem grafiki.')
    const groups = [MAILING_GROUP]
    const talent = free().find((t) => !input.talentId || t.id === input.talentId)
    if (!talent) throw new Error('Brak wolnego talentu w Dary Ciemności / Ekskluzywne.')
    if (!renderer) throw new Error('Generator materiałów jest niedostępny.')
    const template = renderer.readTemplate().template
    const payload = { template, preview: talent, sequenceNumber: recipient.sequenceNumber }
    const pdf = await renderer.renderMaterial('pdf', payload)
    const png = await renderer.renderMaterial('png', payload)
    const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const subject = 'Klanarchia — talent za wsparcie projektu'
    const code = generateCode()
    const html = `<!doctype html><html lang="pl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;max-width:680px;margin:24px auto;padding:0 20px;line-height:1.6;color:#241e17"><p>Dziękujemy za wsparcie Klanarchii!</p><p>Przygotowaliśmy dla Ciebie coś specjalnego: <strong>unikalny talent, z którego tylko Ty możesz korzystać!</strong> To Twoja wyjątkowa nagroda — talent znajdziesz w załączonym pliku PDF.</p><p><strong>Podziel się tą wiadomością w mediach społecznościowych!</strong><br>Daj znać, że masz własny, unikalny talent do Klanarchii. W załączniku znajdziesz również grafikę przygotowaną specjalnie na tę okazję. Możesz ją opublikować i zachęcić innych do wsparcia zbiórki.</p><p>Dodaj do swojego posta hashtag <strong>#Klanarchia</strong>. Po 50 udostępnieniach odblokujemy kolejny cel społecznościowy!</p><p><strong>Przesyłamy Ci również Twój unikalny kod:</strong></p><p style="padding:16px 24px;background:#f1e8d7;border:1px solid #c8af80;text-align:center"><strong style="font-family:monospace;font-size:28px;letter-spacing:3px">${escape(code)}</strong></p><p>Będziesz mógł użyć go w edytorze talentów, aby dodać swój talent do karty postaci lub arkusza talentów.</p><p>Edytor talentów to kolejny cel naszej zbiórki. Pomóż nam go odblokować, dzieląc się tą wiadomością z innymi!</p><p>Do zobaczenia w świecie Klanarchii!<br>Zespół Klanarchii</p>${renderMailingFooter()}</body></html>`
    let bcc = ''
    const smtpFile = path.join(root, 'smtp.json')
    if (fs.existsSync(smtpFile)) bcc = JSON.parse(fs.readFileSync(smtpFile, 'utf8').replace(/^\uFEFF/, '')).bcc || ''
    const draft = { schemaVersion: 1, id: randomUUID(), status: 'preview', createdAt: new Date().toISOString(), recipientId: recipient.id, sequenceNumber: recipient.sequenceNumber, to: recipient.email, bcc, subject, code, groups, talent, template }
    const directory = path.join(messages, draft.id)
    fs.mkdirSync(directory, { recursive: true })
    try {
      fs.writeFileSync(path.join(directory, 'talent.pdf'), pdf)
      fs.writeFileSync(path.join(directory, 'facebook.png'), png)
      fs.writeFileSync(path.join(directory, 'email.html'), html)
      fs.writeFileSync(path.join(directory, 'message.json'), JSON.stringify(draft, null, 2), { mode: 0o600 })
    } catch (error) { fs.rmSync(directory, { recursive: true, force: true }); throw error }
    return draft
  }))
  app.get('/api/mailing-list/preview-file', async (request, response) => {
    response.set('Cache-Control', 'no-store')
    const { id, file: name } = request.query
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || !['email.html', 'talent.pdf', 'facebook.png'].includes(name)) return response.status(400).end()
    const target = path.join(messages, id, name)
    if (!fs.existsSync(path.join(messages, id, 'message.json')) || !fs.existsSync(target)) return response.status(404).end()
    response.sendFile(target)
  })
}
module.exports = { installMailingPreview }
