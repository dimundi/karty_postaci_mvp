import { useEffect, useMemo, useRef, useState } from 'react'
import fontUrl from '../assets/fonts/NotoSans-Regular.ttf'
import { TalentTemplate, PreviewTalent, PARTS, defaultTemplate, renderTemplate, fitText } from '../talentTemplates/template.cjs'
import './talent-template-creator.css'

type Saved = { template: TalentTemplate; revision: string | null }
const sample: PreviewTalent = { id: 'preview', name: 'Nazwa talentu', flavorDescription: 'Przykładowy opis fabularny.', description: 'Przykładowy opis działania talentu.', usesPerMission: 3, isDarkGift: true, code: null }
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options), data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nie udało się wczytać danych.')
  return data as T
}
export default function TalentTemplateCreator() {
  const [template, setTemplate] = useState<TalentTemplate>(defaultTemplate)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [talents, setTalents] = useState<PreviewTalent[]>([])
  const [preview, setPreview] = useState<PreviewTalent>(sample)
  const [sourceId, setSourceId] = useState('')
  const [selected, setSelected] = useState('status')
  const [guides, setGuides] = useState(true)
  const [zoom, setZoom] = useState(() => window.innerWidth < 700 ? 1 : 2.5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [overflow, setOverflow] = useState<string[]>([])
  const iframe = useRef<HTMLIFrameElement>(null)
  const dirty = Boolean(saved && JSON.stringify(template) !== JSON.stringify(saved.template))
  const html = useMemo(() => renderTemplate(template, preview, { fontUrl, highlight: guides ? selected : '' }), [template, preview, guides, selected])
  useEffect(() => {
    let active = true
    void Promise.all([api<Saved>('/api/talent-template'), api<{ talents: PreviewTalent[] }>('/api/talents')]).then(([data, library]) => {
      if (!active) return
      setSaved(data); setTemplate(data.template); setTalents(library.talents)
      if (library.talents[0]) { setPreview(library.talents[0]); setSourceId(library.talents[0].id) }
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (saved && !busy) void save() } }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  })
  const canLeave = () => !dirty || window.confirm('Porzucić niezapisane ustawienia szablonu?')
  const patchPreview = (values: Partial<PreviewTalent>) => setPreview((p) => ({ ...p, ...values }))
  async function save() {
    if (!saved) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api<Saved>('/api/talent-template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template, revision: saved.revision }) })
      setSaved(data); setTemplate(data.template); setMessage('Zapisano wspólny szablon talentu.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function reload() {
    if (!canLeave()) return
    setBusy(true); setError(''); setMessage('')
    try { const data = await api<Saved>('/api/talent-template'); setSaved(data); setTemplate(data.template) }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function inspect() {
    const doc = iframe.current?.contentDocument
    if (!doc) return
    await doc.fonts.ready
    if (doc === iframe.current?.contentDocument) setOverflow(fitText(doc))
  }
  async function pdf(format: 'pdf' | 'png' = 'pdf') {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(format === 'png' ? '/api/talent-template-social' : '/api/talent-template-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template, preview }) })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Błąd eksportu PDF.') }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
      link.href = url; link.download = format === 'png' ? 'moj-talent-klanarchia.png' : 'proba-talentu.pdf'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      setMessage(format === 'png' ? 'Wygenerowano grafikę do samodzielnego udostępnienia na Facebooku.' : 'Wygenerowano próbny PDF. Dane talentu pozostają bez zmian.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const numeric = (key: 'padding' | 'statusHeight' | 'iconGap' | 'textGap' | 'fontSize' | 'minFontSize' | 'lineHeight', label: string, min: number, max: number) => <label>{label}<input type="number" value={template[key]} min={min} max={max} step="0.1" onChange={(e) => {
    const value = e.target.valueAsNumber
    if (!Number.isFinite(value)) return
    const n = Math.max(min, Math.min(max, value))
    setTemplate((t) => ({ ...t, [key]: n, ...(key === 'fontSize' ? { minFontSize: Math.min(t.minFontSize, n) } : {}) })); setMessage('')
  }} /></label>
  return <main className="tt-creator">
    <header className="tt-header"><div><a href="#dev" onClick={(e) => { if (busy || !canLeave()) e.preventDefault() }}>← WORKSHOP</a><h1>Kreator szablonów talentów</h1><p>Jeden wspólny szablon HTML · ramka 65,5 × 35,9 mm</p></div><div className="tt-toolbar"><button disabled={busy} onClick={() => void reload()}>Wczytaj ponownie</button><button className="tt-primary" disabled={busy || !saved || !dirty} onClick={() => void save()}>Zapisz szablon</button><button disabled={busy || !saved || overflow.length > 0} onClick={() => void pdf()}>Pobierz próbny PDF</button><button disabled={busy || !saved || overflow.length > 0} onClick={() => void pdf('png')}>Pobierz grafikę na Facebooka</button></div></header>
    {error && <p className="tt-error" role="alert">{error}</p>}{message && <p className="tt-success" role="status">{message}</p>}{busy && <p role="status">Przetwarzanie…</p>}
    {!saved ? <p>Wczytywanie szablonu…</p> : <div className="tt-layout">
      <aside className="tt-panel"><h2>Elementy szablonu</h2><p className="tt-note">Lista jest stała. Kliknij element, aby wskazać go na karcie.</p><div className="tt-parts">{Object.entries(PARTS).map(([id, label]) => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{label}{id === 'darkGift' && !preview.isDarkGift ? ' — nieaktywna' : id === 'uses' && !preview.usesPerMission ? ' — nieaktywne' : ''}</button>)}</div><p className="tt-note">Ramka ma stałą wielkość. Ikony i kwadraty pokazują się według parametrów, niezależnie od grupy talentu.</p><h2>Wygląd wspólny</h2><fieldset disabled={busy}>
        {numeric('padding', 'Margines wewnętrzny (pt)', 2, 15)}{numeric('statusHeight', 'Bazowy rozmiar ikon (pt)', 5, 22)}{numeric('iconGap', 'Odstęp między ikonami (pt)', 0, 10)}{numeric('textGap', 'Odstęp pod paskiem (pt)', 0, 12)}{numeric('fontSize', 'Rozmiar tekstu (pt)', 4, 20)}{numeric('lineHeight', 'Interlinia', 1, 2)}
        <label className="tt-check"><input type="checkbox" checked={template.autoFit} onChange={(e) => setTemplate((t) => ({ ...t, autoFit: e.target.checked }))} />Zmniejszaj tekst do ramki</label>{template.autoFit && numeric('minFontSize', 'Minimalny rozmiar tekstu (pt)', 3, template.fontSize)}
        {([['color', 'Kolor tekstu'], ['flavorColor', 'Kolor opisu fabularnego'], ['background', 'Tło karty']] as const).map(([key, label]) => <label key={key}>{label}<input type="color" value={template[key]} onChange={(e) => setTemplate((t) => ({ ...t, [key]: e.target.value }))} /></label>)}
        <p className="tt-note">{dirty ? '● Niezapisane ustawienia' : 'Ustawienia zapisane'} · Ctrl+S — zapis</p>
      </fieldset></aside>
      <section className="tt-workspace" aria-label="Podgląd talentu"><div className="tt-preview-toolbar"><div className="tt-zoom"><button aria-label="Pomniejsz" onClick={() => setZoom((z) => Math.max(.5, z - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Powiększ" onClick={() => setZoom((z) => Math.min(5, z + .25))}>+</button></div><label className="tt-check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />Wskaż wybrany element</label></div>
        {overflow.length > 0 && <p className="tt-error" role="alert">Tekst nie mieści się w ramce. Zmniejsz czcionkę lub odstępy.</p>}
        {selected === 'darkGift' && !preview.isDarkGift && <p className="tt-note">Ikona Daru Ciemności jest wyłączona. Włącz flagę w danych podglądu, aby ją zobaczyć.</p>}
        <div className="tt-canvas-scroll"><div className="tt-page" style={{ width: template.page.width * 4 / 3 * zoom, height: template.page.height * 4 / 3 * zoom }}><iframe ref={iframe} title="Karta talentu" srcDoc={html} onLoad={() => void inspect()} style={{ width: template.page.width * 4 / 3, height: template.page.height * 4 / 3, transform: `scale(${zoom})` }} /></div></div>
        <p className="tt-note">Heks i aktywne ikony od lewej. Kwadraty użyć od prawej. Poniżej jeden blok tekstu.</p><p className="tt-note">Położenie kodu ustalimy później. Na razie szablon go nie wyświetla i nie nadaje kodów.</p>
      </section>
      <aside className="tt-panel"><h2>Dane do podglądu</h2><p className="tt-note">Zmiany tutaj służą tylko do podglądu i próbnego PDF-a. Nie zmieniają talentów w bazie.</p><fieldset disabled={busy}>
        <label>Wczytaj dane talentu<select aria-label="Wczytaj dane talentu" value={sourceId} onChange={(e) => { const t = talents.find((item) => item.id === e.target.value); setSourceId(e.target.value); setPreview(t ? { ...t } : { ...sample }) }}><option value="">Przykładowe dane</option>{talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Nazwa talentu<input maxLength={300} value={preview.name} onChange={(e) => patchPreview({ name: e.target.value })} /></label>
        <label>Opis fabularny<textarea rows={5} maxLength={20000} value={preview.flavorDescription} onChange={(e) => patchPreview({ flavorDescription: e.target.value })} /></label>
        <label>Opis talentu<textarea rows={7} maxLength={20000} value={preview.description} onChange={(e) => patchPreview({ description: e.target.value })} /></label>
        <label>Liczba użyć na misję<select aria-label="Liczba użyć na misję" value={preview.usesPerMission} onChange={(e) => patchPreview({ usesPerMission: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="tt-check"><input type="checkbox" checked={preview.isDarkGift} onChange={(e) => patchPreview({ isDarkGift: e.target.checked })} />Dar Ciemności</label>
      </fieldset></aside>
    </div>}
  </main>
}
