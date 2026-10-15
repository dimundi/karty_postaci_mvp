const ASSETS = { frame: 'talent_ramka.svg', hex: 'hex.svg', darkGift: 'czacha-dary-ciemnoscie.svg', square: 'kwadrat.svg' }
const { hyphenateSync } = require('hyphen/pl')
const PARTS = { frame: 'Ramka', status: 'Pasek statusu', hex: 'Heks', darkGift: 'Ikona Daru Ciemności', uses: 'Kwadraty użyć', text: 'Wspólny blok tekstu', name: 'Nazwa talentu', flavor: 'Opis fabularny', description: 'Opis działania' }
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function polishText(value) {
  const text = String(value ?? '').normalize('NFC')
    .replace(/(?<![\p{L}\p{N}])([aiouwz])[ \t]+(?=\S)/giu, '$1\u00a0')
    .replace(/\p{L}{5,}/gu, (word) => hyphenateSync(word))
  return escape(text)
}
function defaultTemplate() {
  return { schemaVersion: 2, page: { width: 185.67, height: 101.76 }, padding: 7, statusHeight: 13, iconGap: 4, textGap: 4, fontSize: 9, minFontSize: 6, lineHeight: 1.12, autoFit: true, color: '#181818', flavorColor: '#403466', background: '#ffffff' }
}
function renderTemplate(template, talent, options = {}) {
  const { fontUrl = '', images = {}, highlight = '' } = options
  const image = (key, attributes = '') => `<img ${attributes} alt="" src="${escape(images[key] || `/api/talent-asset?file=${encodeURIComponent(ASSETS[key])}`)}" />`
  const count = talent?.usesPerMission ?? 0
  const name = String(talent?.name || '').trim()
  const title = name ? name + (/[:.!?]$/.test(name) ? '' : ':') : ''
  const content = [title && `<strong data-part="name">${polishText(title)}</strong>`, talent?.flavorDescription && `<em data-part="flavor">${polishText(talent.flavorDescription)}</em>`, talent?.description && `<span data-part="description">${polishText(talent.description)}</span>`].filter(Boolean).join(' ')
  const { width, height } = template.page
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Szablon talentu</title><style>
  ${fontUrl ? `@font-face{font-family:TalentNoto;src:url("${escape(fontUrl)}") format("truetype")}` : ''}
  @page{size:${width}pt ${height}pt;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:${width}pt;height:${height}pt;overflow:hidden}body{background:${template.background};color:${template.color};font-family:Georgia,Times,TalentNoto,serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .card{position:relative;width:100%;height:100%;padding:${template.padding}pt;display:flex;flex-direction:column;gap:${template.textGap}pt}
  .frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.status{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;height:${template.statusHeight * 1.35}pt}.icons,.uses{display:flex;align-items:center;gap:${template.iconGap}pt;height:100%}.status img{height:${template.statusHeight}pt;width:${template.statusHeight}pt;object-fit:contain}.status img[data-part="darkGift"]{height:${template.statusHeight * 1.35}pt;width:${template.statusHeight * 1.35}pt}.text{flex:1;min-height:0;overflow:hidden;overflow-wrap:normal;word-break:normal;hyphens:manual;white-space:pre-wrap;font-size:${template.fontSize}pt;line-height:${template.lineHeight}}em{color:${template.flavorColor}}
  ${Object.hasOwn(PARTS, highlight) ? `[data-part="${highlight}"]{outline:1px dashed #b47728;outline-offset:1px}` : ''}
  </style></head><body><div class="card">${image('frame', 'class="frame" data-part="frame"')}<div class="status" data-part="status"><div class="icons">${image('hex', 'data-part="hex"')}${talent?.isDarkGift === true ? image('darkGift', 'data-part="darkGift"') : ''}</div><div class="uses" data-part="uses">${Array.from({ length: count }, () => image('square', 'data-use-square')).join('')}</div></div><div class="text" data-part="text" data-text="text" data-auto-fit="${template.autoFit}" data-min-size="${template.minFontSize * 4 / 3}">${content}</div></div></body></html>`
}
function fitText(root) {
  const doc = root || document
  const overflow = []
  for (const node of doc.querySelectorAll('[data-text]')) {
    let size = parseFloat(doc.defaultView.getComputedStyle(node).fontSize)
    const minimum = Number(node.dataset.minSize)
    if (node.dataset.autoFit === 'true') {
      while ((node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) && size > minimum) {
        size = Math.max(minimum, size - 0.25); node.style.fontSize = `${size}px`
      }
    }
    if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) overflow.push(node.dataset.text)
  }
  return overflow
}
module.exports = { ASSETS, PARTS, defaultTemplate, renderTemplate, fitText, polishText }
