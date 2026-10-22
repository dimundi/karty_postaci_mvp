const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const express = require('express')
const nodemailer = require('nodemailer')
const { randomUUID } = require('node:crypto')
const { installMailingSend } = require('./mailing-send-server.cjs')
const { chromium } = require('playwright-core')
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-send-'))
  const id = randomUUID(), dir = path.join(root, 'messages', id)
  fs.mkdirSync(dir, { recursive: true })
  const recipient = { id: 'recipient', email: 'recipient@example.com', createdAt: new Date().toISOString(), sequenceNumber: 900, orderId: 'TEST', deliveryStatus: 'not_sent', talentId: null }
  const talent = { id: 'talent-test', name: 'Test', flavorDescription: '', description: 'Opis.', usesPerMission: 0, group: 'Dary Ciemności', subgroup: 'Ekskluzywne', code: null, isDarkGift: true, isAction: false, oncePerScene: false, dev_type: null }
  const talentsFile = path.join(root, 'talents.json'), listFile = path.join(root, 'mailing-list.json')
  fs.writeFileSync(talentsFile, JSON.stringify({ schemaVersion: 1, talents: [talent] }))
  fs.writeFileSync(listFile, JSON.stringify({ recipients: [recipient] }))
  const read = () => JSON.parse(fs.readFileSync(listFile, 'utf8'))
  const save = (list) => fs.writeFileSync(listFile, JSON.stringify(list))
  const draft = { id, status: 'preview', code: 'ABCD-2345', recipientId: recipient.id, to: recipient.email, bcc: 'owner@example.com', subject: 'Próba', talent }
  const config = { host: 'smtp.example.com', port: 587, encryption: 'starttls', auth: { user: 'test', pass: 'secret' }, from: { name: 'Klanarchia', email: 'sender@example.com' }, bcc: draft.bcc }
  fs.writeFileSync(path.join(root, 'smtp.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(dir, 'message.json'), JSON.stringify(draft))
  fs.writeFileSync(path.join(dir, 'email.html'), '<p>Zaakceptowana treść XXXX-XXXX</p>')
  fs.writeFileSync(path.join(dir, 'talent.pdf'), '%PDF-TEST')
  fs.writeFileSync(path.join(dir, 'facebook.png'), 'PNG-TEST')
  const before = fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f)).toString('base64')])
  let captured, options, compiledMessage, fail = true, calls = 0, accepted = [draft.to, draft.bcc]
  const app = express()
  const settings = { root, read, save, talentsFile, readBody: async (req) => { const parts = []; for await (const p of req) parts.push(p); return JSON.parse(Buffer.concat(parts)) }, endpoint: (fn) => async (req, res) => { try { res.json(await fn(req)) } catch (e) { res.status(400).json({ error: e.message }) } }, createTransport: (opts) => {
    options = opts
    return { close() {}, async sendMail(message) {
      calls++
      assert.equal(read().recipients.find((r) => r.id === recipient.id).deliveryStatus, 'sending')
      assert.equal(read().recipients.find((r) => r.id === recipient.id).code, draft.code)
      assert.equal(JSON.parse(fs.readFileSync(talentsFile)).talents[0].code, draft.code)
      if (fail) { const e = new Error('private secret SMTP response'); e.code = 'EAUTH'; throw e }
      captured = message
      compiledMessage = await nodemailer.createTransport({ name: 'local-mime-test', version: '1', send(mail, callback) { mail.message.build((error, buffer) => callback(error, { envelope: mail.message.getEnvelope(), message: buffer })) } }).sendMail(message)
      return { accepted, rejected: accepted.includes(draft.to) ? [] : [draft.to], messageId: 'test-message' }
    } }
  } }
  installMailingSend(app, settings)
  app.get('/api/mailing-list', (_req, res) => res.json(read()))
  app.get('/api/mailing-list/preview-options', (_req, res) => res.json({ talents: [] }))
  app.get('/api/mailing-list/preview-file', (req, res) => {
    if (req.query.id !== id || !['facebook.png', 'talent.pdf'].includes(req.query.file)) return res.status(404).end()
    res.sendFile(path.join(dir, req.query.file))
  })
  const previews = []
  app.post('/api/mailing-list/preview', async (req, res) => {
    const input = await settings.readBody(req)
    previews.push(input)
    const entry = read().recipients.find((r) => r.id === input.recipientId)
    res.json({ ...draft, recipientId: entry.id, to: entry.email })
  })
  // Druga instancja symuluje restart: blokady muszą wynikać z plików.
  const restarted = express(); installMailingSend(restarted, settings)
  const restartedServer = restarted.listen(0, '127.0.0.1'); await new Promise((r) => restartedServer.once('listening', r))
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r))
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/mailing-list/preview-send`, { method: 'POST', body: JSON.stringify(body) })
  let browser
  try {
    assert.equal((await post({ draftId: '../bad' })).status, 400)
    const failed = await post({ draftId: id }); const failure = await failed.json()
    assert.equal(failed.status, 400); assert.ok(!failure.error.includes('secret'))
    assert.equal(read().recipients[0].deliveryStatus, 'error')
    assert.equal(read().recipients[0].talentId, talent.id)
    assert.equal(read().recipients[0].code, draft.code)
    const rivalId = randomUUID(), rivalDir = path.join(root, 'messages', rivalId)
    fs.cpSync(dir, rivalDir, { recursive: true })
    const rival = { ...draft, id: rivalId, recipientId: 'rival', to: 'other@example.com', code: 'EFGH-6789' }
    fs.writeFileSync(path.join(rivalDir, 'message.json'), JSON.stringify(rival))
    const currentList = read()
    currentList.recipients.push({ id: rival.recipientId, email: rival.to, deliveryStatus: 'not_sent', talentId: null })
    save(currentList)
    assert.equal((await post({ draftId: rivalId })).status, 400)
    assert.equal(calls, 1, 'Przypisany talent nie może zostać wysłany drugiemu odbiorcy.')
    const interrupted = read()
    interrupted.recipients[0].deliveryStatus = 'sending'; save(interrupted)
    assert.equal((await fetch(`http://127.0.0.1:${restartedServer.address().port}/api/mailing-list/preview-send`, { method: 'POST', body: JSON.stringify({ draftId: id }) })).status, 400)
    interrupted.recipients[0].deliveryStatus = 'error'; save(interrupted)
    fail = false
    // Przyjęcie samego BCC nie oznacza wysłania do odbiorcy.
    accepted = [draft.bcc]
    assert.equal((await post({ draftId: id })).status, 400)
    assert.equal(read().recipients[0].deliveryStatus, 'error')
    accepted = [draft.to, draft.bcc]
    const response = await post({ draftId: id }); assert.equal(response.status, 200, JSON.stringify(await response.json()))
    assert.ok(compiledMessage.envelope.to.includes(draft.to)); assert.ok(compiledMessage.envelope.to.includes(draft.bcc))
    const mime = compiledMessage.message.toString()
    assert.ok(!/^Bcc:/mi.test(mime)); assert.ok(mime.includes('talent.pdf')); assert.ok(mime.includes('moj-talent-klanarchia.png'))
    assert.equal(options.requireTLS, true); assert.equal(options.secure, false)
    assert.equal(captured.html, '<p>Zaakceptowana treść XXXX-XXXX</p>')
    assert.equal(captured.attachments[0].content.toString(), '%PDF-TEST')
    assert.equal(read().recipients[0].deliveryStatus, 'sent')
    assert.equal(read().recipients[0].code, draft.code)
    assert.equal(read().recipients[0].talentId, talent.id)
    assert.ok(read().recipients[0].sentAt)
    assert.deepEqual(fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f)).toString('base64')]), before)
    assert.equal((await post({ draftId: id })).status, 400)
    assert.equal((await fetch(`http://127.0.0.1:${restartedServer.address().port}/api/mailing-list/preview-send`, { method: 'POST', body: JSON.stringify({ draftId: id }) })).status, 400)
    config.bcc = 'changed@example.com'; fs.writeFileSync(path.join(root, 'smtp.json'), JSON.stringify(config))
    assert.equal((await post({ draftId: id })).status, 400); assert.equal(calls, 3)
    // Sprawdzenie UI na tym samym fałszywym SMTP i tymczasowych danych.
    config.bcc = draft.bcc; fs.writeFileSync(path.join(root, 'smtp.json'), JSON.stringify(config))
    const uiList = read()
    uiList.recipients = [
      { ...recipient, id: 'third', sequenceNumber: 903, email: 'third@example.com' },
      { ...uiList.recipients[0], deliveryStatus: 'error' },
      { ...recipient, id: 'next', sequenceNumber: 901, email: 'next@example.com' },
    ]
    save(uiList)
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/api/mailing-list**', async (route) => {
      const url = new URL(route.request().url())
      const response = await route.fetch({ url: `http://127.0.0.1:${server.address().port}${url.pathname}${url.search}` })
      await route.fulfill({ response })
    })
    await page.goto('http://localhost:8080/#dev-mailing-list')
    await page.getByRole('button', { name: `Wyślij do ${recipient.email}`, exact: true }).click()
    await page.getByRole('button', { name: 'Przygotuj podgląd', exact: true }).click()
    await page.getByRole('button', { name: 'Wyślij', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Wysłano. Zapisano przypisanie talentu i kod.' }).waitFor()
    const callsBeforeNext = calls
    await page.getByRole('button', { name: 'Kolejny', exact: true }).click()
    await page.getByText('Nr 901 · next@example.com', { exact: true }).waitFor()
    await page.locator('.mailing-envelope').filter({ hasText: 'Do: next@example.com' }).waitFor()
    assert.deepEqual(previews[previews.length - 1], { recipientId: 'next', talentId: null })
    assert.equal(calls, callsBeforeNext, 'Kolejny nie może wysyłać wiadomości.')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Wyślij' && !button.disabled))
    await page.getByRole('button', { name: 'Kolejny', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Brak odbiorcy o numerze 902.' }).waitFor()
    await page.getByText('Nr 901 · next@example.com', { exact: true }).waitFor()
    assert.equal(calls, callsBeforeNext)
    await page.getByRole('button', { name: '← Wróć do listy', exact: true }).click()
    const row = page.getByRole('row').filter({ hasText: recipient.email })
    await row.getByText('Wysłano', { exact: true }).waitFor()
    await row.getByText(draft.code, { exact: true }).waitFor()
    assert.ok(await row.getByRole('button', { name: `Wyślij do ${recipient.email}`, exact: true }).isDisabled())
    const previewCount = previews.length
    await row.getByRole('button', { name: `Zobacz materiały dla ${recipient.email}`, exact: true }).click()
    await page.getByRole('heading', { name: 'Wysłane materiały', exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Otwórz PDF', exact: true }).getAttribute('href'), `/api/mailing-list/preview-file?id=${id}&file=talent.pdf`)
    assert.equal(await page.getByRole('link', { name: 'Otwórz grafikę', exact: true }).getAttribute('href'), `/api/mailing-list/preview-file?id=${id}&file=facebook.png`)
    assert.equal(await page.getByTitle('PDF wysłanego talentu', { exact: true }).getAttribute('src'), `/api/mailing-list/preview-file?id=${id}&file=talent.pdf`)
    assert.equal(await page.getByRole('button', { name: 'Wyślij', exact: true }).count(), 0)
    assert.equal(calls, callsBeforeNext)
    assert.equal(previews.length, previewCount)
    await page.getByRole('button', { name: '← Wróć do listy', exact: true }).click()
    await row.getByText('Wysłano', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('OK: trwałe przypisanie i kod przed SMTP, błąd i ponowienie z tą samą nagrodą, status sent, blokada ponowienia po restarcie, BCC, MIME, załączniki, STARTTLS. Bez prawdziwej poczty.')
  } finally { if (browser) await browser.close(); server.close(); restartedServer.close(); fs.rmSync(root, { recursive: true, force: true }) }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
