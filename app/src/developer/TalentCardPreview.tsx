import { useEffect, useMemo, useRef, useState } from 'react'
import { talentFontUrls } from '../talentTemplates/fonts'
import { TalentTemplate, PreviewTalent, renderTemplate, fitText } from '../talentTemplates/template.cjs'

export default function TalentCardPreview({ talent }: { talent: PreviewTalent }) {
  const [template, setTemplate] = useState<TalentTemplate | null>(null)
  const [error, setError] = useState('')
  const [overflow, setOverflow] = useState(false)
  const [width, setWidth] = useState(0)
  const canvas = useRef<HTMLDivElement>(null)
  const iframe = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    let active = true
    void fetch('/api/talent-template').then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nie udało się wczytać szablonu.')
      if (active) setTemplate(data.template)
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const current = useRef(talent)
  current.current = talent
  const html = useMemo(() => template ? renderTemplate(template, null, { fontUrls: talentFontUrls }) : '', [template])
  function fit(doc: Document) {
    const text = doc.querySelector<HTMLElement>('[data-text]')
    if (text) text.style.fontSize = ''
    setOverflow(fitText(doc).length > 0)
  }
  function updatePreview(doc: Document) {
    if (!template || doc !== iframe.current?.contentDocument || !doc.querySelector('.text')) return
    const rendered = new DOMParser().parseFromString(renderTemplate(template, current.current, { fontUrls: talentFontUrls }), 'text/html')
    for (const selector of ['.text', '.status']) {
      const target = doc.querySelector(selector), source = rendered.querySelector(selector)
      if (target && source) target.replaceChildren(...Array.from(source.childNodes).map((node) => doc.importNode(node, true)))
    }
    fit(doc)
  }
  useEffect(() => {
    const doc = iframe.current?.contentDocument
    if (doc?.readyState === 'complete') updatePreview(doc)
  }, [talent, template])
  async function inspect() {
    const doc = iframe.current?.contentDocument
    if (!doc) return
    await Promise.all(['12px TalentLibertine', '600 12px TalentLibertine', 'bold 12px TalentLibertine', 'italic 12px TalentLibertine', 'italic bold 12px TalentLibertine'].map((font) => doc.fonts.load(font)))
    await doc.fonts.ready
    if (doc !== iframe.current?.contentDocument) return
    updatePreview(doc)
  }
  const pageWidth = template ? template.page.width * 4 / 3 : 1
  const pageHeight = template ? template.page.height * 4 / 3 : 1
  const scale = width / pageWidth
  return <section className="talent-card-preview" aria-label="Podgląd karty talentu">
    {error && <p className="talent-error" role="alert">{error}</p>}
    {!template && !error && <p role="status">Wczytywanie szablonu…</p>}
    <div ref={canvas} className="talent-card-canvas">
      {template && width > 0 && <div style={{ height: pageHeight * scale }}>
        <iframe ref={iframe} title="Karta wybranego talentu" sandbox="allow-same-origin" srcDoc={html} onLoad={() => void inspect()} style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})` }} />
      </div>}
    </div>
    {overflow && <p className="talent-error" role="status">Tekst nie mieści się w ramce. Skróć go lub zmień ustawienia wspólnego szablonu.</p>}
  </section>
}
