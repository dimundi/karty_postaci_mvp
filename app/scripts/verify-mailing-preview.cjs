const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')
const { installMailingPreview } = require('./mailing-preview-server.cjs')
const { installTalentTemplates } = require('./talent-templates-server.cjs')
const { renderSocialPoster } = require('./talent-social-poster.cjs')
const { isMailingTalent } = require('./mailing-talent-pool.cjs')
async function main() {
  const posterInput = { card: Buffer.from('test'), sequenceNumber: 901 }
  assert.match(renderSocialPoster(posterInput), /Talent nr: 901/)
  for (const [sequenceNumber, display] of [[1, '001'], [12, '012'], [100, '100'], [1000, '1000']]) {
    assert.ok(renderSocialPoster({ ...posterInput, sequenceNumber }).includes(`Talent nr: ${display}</p>`))
  }
  assert.ok(!renderSocialPoster({ ...posterInput, sequenceNumber: undefined }).includes('Talent nr:'))
  assert.throws(() => renderSocialPoster({ ...posterInput, sequenceNumber: '<script>' }))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-preview-'))
  const talentsFile = path.join(dir, 'talents.json')
  const source = fs.readFileSync('/cardTemplates/talenty/talenty.json', 'utf8')
  fs.writeFileSync(talentsFile, source)
  const first = JSON.parse(source).talents.find(isMailingTalent)
  assert.ok(first, 'Brak talentu z puli Dary Ciemności / Ekskluzywne.')
  const outside = JSON.parse(source).talents.find((t) => !isMailingTalent(t))
  assert.ok(outside)
  const recipient = { id: 'test', email: 'preview@example.com', sequenceNumber: 901, deliveryStatus: 'not_sent', talentId: null }
  const original = JSON.stringify(recipient)
  const app = express()
  const renderer = installTalentTemplates(app)
  const renderMaterial = renderer.renderMaterial
  const renderedNumbers = []
  renderer.renderMaterial = (format, input) => { renderedNumbers.push(input.sequenceNumber); return renderMaterial(format, input) }
  const readBody = async (req) => { const parts = []; for await (const chunk of req) parts.push(chunk); return JSON.parse(Buffer.concat(parts)) }
  const endpoint = (handler) => async (req, res) => { try { res.json(await handler(req)) } catch (e) { res.status(400).json({ error: e.message }) } }
  installMailingPreview(app, { file: path.join(dir, 'mailing-list.json'), read: () => ({ recipients: [recipient] }), renderer, endpoint, readBody, talentsFile })
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}/api/mailing-list/`
  const post = (route, body) => fetch(base + route, { method: 'POST', body: JSON.stringify(body) })
  try {
    const options = await (await fetch(base + 'preview-options')).json()
    assert.ok(options.talents.length > 0)
    assert.ok(options.talents.every(isMailingTalent))
    assert.ok(!options.talents.some((t) => t.id === outside.id))
    assert.equal((await post('preview', { recipientId: 'test', talentId: outside.id })).status, 400)
    assert.equal((await post('preview-selection', { groups: ['nonexistent'] })).status, 400)
    assert.equal((await post('preview-selection', { groups: [first.group] })).status, 200)
    assert.equal((await post('preview', { recipientId: 'missing' })).status, 400)
    delete recipient.sequenceNumber
    assert.equal((await post('preview', { recipientId: 'test', talentId: first.id })).status, 400)
    recipient.sequenceNumber = 901
    const response = await post('preview', { recipientId: 'test', talentId: first.id })
    const draft = await response.json(); assert.equal(response.status, 200, draft.error)
    assert.equal(draft.status, 'preview'); assert.equal(draft.talent.code, null)
    assert.match(draft.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    assert.ok(fs.readFileSync(path.join(dir, 'messages', draft.id, 'email.html'), 'utf8').includes(draft.code))
    assert.equal(draft.talent.id, first.id)
    assert.equal(draft.sequenceNumber, 901)
    assert.deepEqual(renderedNumbers, [901, 901])
    const pdf = await fetch(base + `preview-file?id=${draft.id}&file=talent.pdf`)
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF')
    const png = await fetch(base + `preview-file?id=${draft.id}&file=facebook.png`)
    assert.equal(Buffer.from(await png.arrayBuffer()).subarray(1, 4).toString(), 'PNG')
    fs.mkdirSync('/app/.cache', { recursive: true })
    fs.copyFileSync(path.join(dir, 'messages', draft.id, 'facebook.png'), '/app/.cache/talent-number-preview.png')
    assert.equal((await fetch(base + `preview-file?id=${draft.id}&file=message.json`)).status, 400)
    assert.equal(fs.readFileSync(talentsFile, 'utf8'), source)
    assert.deepEqual(recipient, JSON.parse(original))
    Object.assign(recipient, { deliveryStatus: 'error', talentId: draft.talent.id, code: draft.code, draftId: draft.id })
    const retry = await post('preview', { recipientId: 'test', talentId: outside.id })
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), draft)
    assert.deepEqual(renderedNumbers, [901, 901], 'Ponowienie używa zapisanych materiałów.')
    const reservedOptions = await (await fetch(base + 'preview-options')).json()
    assert.ok(!reservedOptions.talents.some((t) => t.id === draft.talent.id))
    recipient.deliveryStatus = 'sent'
    assert.equal((await post('preview', { recipientId: 'test' })).status, 400)
    console.log('OK: numer kolejny odbiorcy na plakacie i w podglądzie, wybór grup, walidacja, prywatny zapis podglądu, PDF i PNG, brak rezerwacji i zmian źródeł.')
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }) }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
