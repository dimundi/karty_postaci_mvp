import { useEffect, useRef, useState } from 'react'
import './talent-library.css'
import TalentCardPreview from './TalentCardPreview'

type Talent = {
  id: string
  name: string
  flavorDescription: string
  description: string
  usesPerMission: number
  group: string
  subgroup: string | null
  code: string | null
  isDarkGift: boolean
  isAction: boolean
  oncePerScene: boolean
  dev_type: string | null
}
type Library = { schemaVersion: number; talents: Talent[]; revision: string; devTypes: string[] }
type ImportRow = { talent: Talent; action: 'add' | 'update' | 'unchanged' }
type Preview = { revision: string; rows: ImportRow[]; ignoredSheets?: string[] }
const actionNames = { add: 'Nowy', update: 'Zmiana', unchanged: 'Bez zmian' }
const descriptionFormats = [
  { label: 'Pogrubienie', open: '**', close: '**' },
  { label: 'Kursywa', open: '*', close: '*' },
  { label: 'Cecha', open: '[cecha: ', close: ']' },
  { label: 'Aspekt', open: '[aspekt: ', close: ']' },
  { label: 'Stan', open: '[stan: ', close: ']' },
]
const searchable = (value: string) => value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l')
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Nie udało się odczytać danych.')
  return result as T
}
const jsonPost = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })

export default function TalentLibrary() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [draft, setDraft] = useState<Talent | null>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [subgroup, setSubgroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importSource, setImportSource] = useState<'legacy' | 'googledoc'>('legacy')
  const [importGroup, setImportGroup] = useState('Dary Ciemności')
  const [importSubgroup, setImportSubgroup] = useState('')
  const [importDarkGift, setImportDarkGift] = useState(false)
  const [overrideDarkGift, setOverrideDarkGift] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const descriptionInput = useRef<HTMLTextAreaElement>(null)
  const saved = library?.talents.find((t) => t.id === draft?.id)
  const dirty = Boolean(draft && (!saved || JSON.stringify(draft) !== JSON.stringify(saved)))

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    let active = true
    void api<Library>('/api/talents').then((data) => {
      if (active) { setLibrary(data); setDraft(data.talents[0] || null) }
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  const canLeave = () => !dirty || window.confirm('Porzucić niezapisane zmiany talentu?')
  function createTalent() {
    if (busy || !library || !canLeave()) return
    setDraft({ id: '', name: '', flavorDescription: '', description: '', usesPerMission: 0, group: group || 'Dary Ciemności', subgroup: subgroup && subgroup !== '__none' ? subgroup : null, code: null, isDarkGift: false, isAction: false, oncePerScene: false, dev_type: null })
    setImportOpen(false); setError(''); setMessage('')
  }
  function changeFilter(nextGroup: string, nextSubgroup: string) {
    if (busy || (nextGroup === group && nextSubgroup === subgroup) || !canLeave()) return
    if (dirty) setDraft(saved || null)
    setGroup(nextGroup); setSubgroup(nextSubgroup)
  }
  const groups = [...new Set(library?.talents.map((t) => t.group))].sort((a, b) => a.localeCompare(b, 'pl'))
  const subgroups = [...new Set(library?.talents.filter((t) => !group || t.group === group).map((t) => t.subgroup).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, 'pl'))
  const devTypes = [...new Set([...(library?.devTypes || []), ...(preview?.rows.map((r) => r.talent.dev_type).filter((value): value is string => Boolean(value)) || []), ...(draft?.dev_type ? [draft.dev_type] : [])])].sort((a, b) => a.localeCompare(b, 'pl'))
  const filtered = library?.talents.filter((t) => (!group || t.group === group) && (!subgroup || (subgroup === '__none' ? t.subgroup === null : t.subgroup === subgroup)) && searchable(`${t.name} ${t.flavorDescription} ${t.description} ${t.code || ''}`).includes(searchable(query))) || []
  const patch = (values: Partial<Talent>) => setDraft((current) => current ? { ...current, ...values } : null)
  function formatDescription(open: string, close: string) {
    const input = descriptionInput.current
    if (!input || !draft || busy) return
    const { value } = input
    let start = input.selectionStart, end = input.selectionEnd
    if (start !== end) {
      while (start < end && /\s/.test(value[start])) start++
      while (end > start && /\s/.test(value[end - 1])) end--
      if (start === end) return
    }
    const next = value.slice(0, start) + open + value.slice(start, end) + close + value.slice(end)
    if (next.length > 20000) { setError('Opis ze znacznikami może mieć najwyżej 20 000 znaków.'); return }
    const scrollTop = input.scrollTop
    patch({ description: next })
    window.requestAnimationFrame(() => {
      if (descriptionInput.current !== input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(start + open.length, end + open.length)
      input.scrollTop = scrollTop
    })
  }
  function clearDescriptionFormatting() {
    const input = descriptionInput.current
    if (!input || !draft || busy) return
    let next = input.value.replace(/\*+/g, '')
    let previous
    do {
      previous = next
      next = next.replace(/\[(?:cecha|aspekt|stan):[ \t]*([^\[\]]*)\]/gi, '$1')
    } while (next !== previous)
    const scrollTop = input.scrollTop
    patch({ description: next })
    window.requestAnimationFrame(() => {
      if (descriptionInput.current !== input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(next.length, next.length)
      input.scrollTop = scrollTop
    })
  }

  async function save() {
    if (!draft || !library) return
    setBusy(true); setError(''); setMessage('')
    try {
      const creating = !draft.id
      const data = await api<Library>(creating ? '/api/talents/create' : '/api/talents/save', jsonPost({ talent: draft, revision: library.revision }))
      setLibrary(data); setDraft(creating ? data.talents[data.talents.length - 1] : data.talents.find((t) => t.id === draft.id) || null); setMessage('Zapisano talent.')
      if (creating) { setQuery(''); setGroup(''); setSubgroup('') }
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function refresh() {
    if (!canLeave()) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api<Library>('/api/talents')
      setLibrary(data); setDraft(data.talents.find((t) => t.id === draft?.id) || data.talents[0] || null); setPreview(null)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function prepareImport() {
    if (!file || !importGroup.trim() || (importSource === 'googledoc' && !importSubgroup.trim())) return
    setBusy(true); setError(''); setMessage(''); setPreview(null)
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Plik przekracza 8 MB.')
      const params = new URLSearchParams({ source: importSource, group: importGroup.trim(), subgroup: importSubgroup.trim(), isDarkGift: String(importDarkGift), overrideDarkGift: String(overrideDarkGift) })
      const data = await api<Preview>(`/api/talents/import-preview?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      setPreview(data)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function confirmImport() {
    if (!preview) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api<Library>('/api/talents/import', jsonPost({ revision: preview.revision, talents: preview.rows.map((r) => r.talent), source: importSource, isDarkGift: importDarkGift, overrideDarkGift }))
      const added = preview.rows.filter((r) => r.action === 'add').length
      const changed = preview.rows.filter((r) => r.action === 'update').length
      setLibrary(data); setDraft(data.talents.find((t) => t.id === draft?.id) || data.talents[0] || null)
      setPreview(null); setImportOpen(false); setFile(null); setGroup(''); setSubgroup(''); setQuery('')
      setMessage(`Import zakończony. Dodano: ${added}. Zaktualizowano: ${changed}.`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="talent-library talent-workspace">
      <header className="talent-header">
        <div>
          <a href="#dev" onClick={(event) => { if (busy || !canLeave()) event.preventDefault() }}>← WORKSHOP</a>
          <h1>Przegląd i import talentów</h1>
          <p>Wewnętrzna lista talentów · {library?.talents.length ?? '…'} talentów</p>
        </div>
        <div className="talent-actions">
          <button disabled={busy || !library} onClick={createTalent}>Nowy talent</button>
          <button disabled={busy} onClick={() => void refresh()}>Odśwież listę</button>
          <button className="talent-primary" disabled={busy || !library} onClick={() => {
            if (!canLeave()) return
            setDraft(saved || null); setImportOpen(true); setPreview(null); setError(''); setMessage('')
          }}>Importuj XLS / XLSX</button>
        </div>
      </header>
      {error && <p className="talent-error" role="alert">{error}</p>}
      {message && <p className="talent-message talent-toast" role="status">{message}</p>}
      {busy && <p role="status">Przetwarzanie…</p>}
      {importOpen ? (
        <section className="talent-import" aria-label="Import talentów">
          <h2>Import z arkusza</h2>
          <p>Podgląd nie zmienia listy. Zatwierdzenie doda nowe talenty i zaktualizuje wskazane poniżej. Nie usuwa talentów nieobecnych w arkuszu.</p>
          <p>Rozpoznajemy talent po kodzie, a gdy go brak — po nazwie, grupie i podgrupie. Nadane ID i kody pozostają zachowane.</p>
          <fieldset disabled={busy}>
            <label>Procedura importu<select aria-label="Procedura importu" value={importSource} onChange={(e) => { setImportSource(e.target.value as 'legacy' | 'googledoc'); setPreview(null); setError('') }}>
              <option value="legacy">XLS / XLSX — 5 kolumn (dotychczasowy)</option>
              <option value="googledoc">GoogleDoc (nowy)</option>
            </select></label>
            <div className="talent-import-fields">
              <label>Plik XLS lub XLSX<input type="file" accept=".xls,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null) }} /></label>
              <label>Grupa importowanych talentów<input value={importGroup} maxLength={200} onChange={(e) => { setImportGroup(e.target.value); setPreview(null) }} /></label>
              <label>{importSource === 'legacy' ? 'Podgrupa (opcjonalna)' : 'Podgrupa dla importu'}<input required={importSource === 'googledoc'} value={importSubgroup} maxLength={200} onChange={(e) => { setImportSubgroup(e.target.value); setPreview(null) }} /></label>
            </div>
            <label className="talent-flag"><input type="checkbox" checked={importDarkGift} onChange={(e) => { setImportDarkGift(e.target.checked); setPreview(null) }} />isDarkGift — Dar Ciemności dla importu</label>
            <label className="talent-flag"><input type="checkbox" checked={overrideDarkGift} onChange={(e) => { setOverrideDarkGift(e.target.checked); setPreview(null) }} />Nadpisz isDarkGift dla wszystkich importowanych talentów</label>
            <p className="talent-muted">Nowe talenty otrzymają wybraną flagę. Istniejące zachowają swoją wartość, chyba że zaznaczysz nadpisanie. Pozostałe talenty w bibliotece nie zmienią się.</p>
            {importSource === 'legacy' ? <p>Kolumny: Nazwa talentu · Opis fabularny · Opis talentu · Ile razy można użyć · Kod. Jeden arkusz, do 8 MB.</p>
              : <p>GoogleDoc — plik XLSX w układzie „Dary Ciemności.xlsx”. Czytamy Arkusz1. „Akcja” ustawia isAction, „Typ” trafia do dev_type. Talenty trafią do jednej wskazanej podgrupy.</p>}
            <div className="talent-actions">
              <button disabled={!file || !importGroup.trim() || (importSource === 'googledoc' && !importSubgroup.trim())} onClick={() => void prepareImport()}>Pokaż podgląd importu</button>
              <button onClick={() => { setImportOpen(false); setPreview(null); setError('') }}>Anuluj</button>
            </div>
            {preview && <div className="talent-import-preview">
              <h2>Podgląd importu</h2>
              <p>Nowe: {preview.rows.filter((r) => r.action === 'add').length} · Zmiany: {preview.rows.filter((r) => r.action === 'update').length} · Bez zmian: {preview.rows.filter((r) => r.action === 'unchanged').length}</p>
              {!!preview.ignoredSheets?.length && <p>Pominięte arkusze: {preview.ignoredSheets.join(', ')}.</p>}
              {preview.rows.map(({ talent, action }, index) => <article className="talent-import-item" key={talent.id}>
                <h3><span className={`talent-badge ${action}`}>{actionNames[action]}</span> {index + 1}. {talent.name}</h3>
                <p>{talent.group}{talent.subgroup ? ` / ${talent.subgroup}` : ''} · Użycia na misję: {talent.usesPerMission} · Kod: {talent.code || 'brak'}</p>
                <p>dev_type: {talent.dev_type || 'brak'} · isDarkGift: {talent.isDarkGift ? 'tak' : 'nie'} · isAction: {talent.isAction ? 'tak' : 'nie'} · Raz na scenę: {talent.oncePerScene ? 'tak' : 'nie'}</p>
                {talent.flavorDescription && <p className="talent-flavor">{talent.flavorDescription}</p>}
                <p className="talent-description">{talent.description}</p>
              </article>)}
              <button className="talent-primary" disabled={preview.rows.every((r) => r.action === 'unchanged')} onClick={() => void confirmImport()}>Zatwierdź import</button>
            </div>}
          </fieldset>
        </section>
      ) : library ? (
        <div className="talent-layout">
          <section className="talent-filters" aria-label="Wyszukiwanie i filtry talentów">
            <label>Szukaj talentu<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nazwa, opis lub kod" /></label>
            <label>Grupa<select disabled={busy} value={group} onChange={(e) => changeFilter(e.target.value, '')}><option value="">Wszystkie grupy</option>{groups.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Podgrupa<select disabled={busy} value={subgroup} onChange={(e) => changeFilter(group, e.target.value)}><option value="">Wszystkie podgrupy</option><option value="__none">Bez podgrupy</option>{subgroups.map((value) => <option key={value}>{value}</option>)}</select></label>
          </section>
          <aside className="talent-sidebar" aria-label="Lista talentów">
            <p className="talent-muted">Wyniki: {filtered.length} / {library.talents.length}</p>
            <div className="talent-list">
              {filtered.map((talent) => <button key={talent.id} disabled={busy} aria-pressed={draft?.id === talent.id} onClick={() => {
                if (draft?.id === talent.id || !canLeave()) return
                setDraft(talent); setError(''); setMessage('')
              }}><strong>{talent.name}</strong><small>{talent.group}{talent.subgroup ? ` / ${talent.subgroup}` : ''}</small></button>)}
              {!filtered.length && <p>{library.talents.length ? 'Brak pasujących talentów.' : 'Lista jest pusta. Zaimportuj arkusz z talentami.'}</p>}
            </div>
          </aside>
          {draft ? <form id="talent-edit-form" className="talent-editor" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <div className="talent-editor-title"><h2>Edycja talentu</h2>
              <div className="talent-actions">
                <button type="submit" className={`talent-primary${dirty ? ' talent-save-dirty' : ''}`} title={dirty ? 'Niezapisane zmiany' : 'Brak zmian do zapisania'} disabled={busy || !dirty}>Zapisz talent</button>
                <button type="button" disabled={busy || !dirty} onClick={() => { if (canLeave()) { setDraft(saved || null); setError('') } }}>Odrzuć zmiany</button>
              </div>
            </div>
            <fieldset disabled={busy}>
              <label>Opis fabularny<textarea rows={5} maxLength={20000} value={draft.flavorDescription} onChange={(e) => patch({ flavorDescription: e.target.value })} /></label>
              <label>Opis talentu<textarea ref={descriptionInput} required rows={8} maxLength={20000} value={draft.description} onChange={(e) => patch({ description: e.target.value })} /></label>
              <div className="talent-actions talent-formatting" role="group" aria-label="Formatowanie opisu talentu">
                {descriptionFormats.map(({ label, open, close }) => <button key={label} type="button" aria-label={label} title={`${label}: ${open}tekst${close}`} onMouseDown={(event) => event.preventDefault()} onClick={() => formatDescription(open, close)}>{label === 'Pogrubienie' ? <strong aria-hidden="true">B</strong> : label === 'Kursywa' ? <i aria-hidden="true">I</i> : label}</button>)}
                <button className="talent-clear-formatting" type="button" title="Usuń wszystkie znaczniki formatowania z całego opisu talentu" onMouseDown={(event) => event.preventDefault()} onClick={clearDescriptionFormatting}>Usuń formatowanie</button>
              </div>
              <label className="talent-flag"><input type="checkbox" checked={draft.isDarkGift} onChange={(e) => patch({ isDarkGift: e.target.checked })} />isDarkGift — Dar Ciemności (pokaż ikonę)</label>
              <label className="talent-flag"><input type="checkbox" checked={draft.isAction} onChange={(e) => patch({ isAction: e.target.checked })} />isAction — Akcja</label>
              <label>dev_type — Typ<select aria-label="dev_type — Typ" value={draft.dev_type || ''} onChange={(e) => patch({ dev_type: e.target.value || null })}><option value="">Brak typu</option>{devTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <div className="talent-usage-row">
                <label>Ile razy można użyć na misję<select value={draft.usesPerMission} onChange={(e) => patch({ usesPerMission: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="talent-flag"><input type="checkbox" checked={draft.oncePerScene} onChange={(e) => patch({ oncePerScene: e.target.checked })} />Raz na scenę</label>
              </div>
                <label>Kod<input readOnly value={draft.code || ''} placeholder="Zostanie nadany przy wysyłce" /></label>
            </fieldset>
          </form> : <section className="talent-editor"><h2>Wybierz talent lub zaimportuj arkusz</h2></section>}
          {draft && <div className="talent-preview-column">
            <section className="talent-details" aria-label="Nazwa i klasyfikacja talentu">
              <fieldset disabled={busy}>
                <label>Nazwa talentu<input form="talent-edit-form" required maxLength={300} value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></label>
                <div className="talent-pair">
                  <label>Grupa<input form="talent-edit-form" required maxLength={200} list="talent-groups" value={draft.group} onChange={(e) => patch({ group: e.target.value })} /><datalist id="talent-groups">{groups.map((value) => <option key={value} value={value} />)}</datalist></label>
                  <label>Podgrupa (opcjonalna)<input form="talent-edit-form" maxLength={200} value={draft.subgroup || ''} onChange={(e) => patch({ subgroup: e.target.value || null })} /></label>
                </div>
                <p className="talent-muted">Grupa i podgrupa służą wyłącznie do zarządzania talentami. Jeśli wpiszesz nową nazwę, po zapisaniu talentu pojawi się ona na dostępnej liście.</p>
              </fieldset>
            </section>
            <TalentCardPreview talent={draft} />
          </div>}
        </div>
      ) : !error && <p role="status">Wczytywanie talentów…</p>}
    </main>
  )
}
