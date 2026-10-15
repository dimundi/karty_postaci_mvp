import { useEffect, useState } from 'react'
import './talent-library.css'

type Talent = {
  id: string
  name: string
  flavorDescription: string
  description: string
  usesPerMission: number
  group: string
  subgroup: string | null
  code: string | null
}
type Library = { schemaVersion: number; talents: Talent[]; revision: string }
type ImportRow = { talent: Talent; action: 'add' | 'update' | 'unchanged' }
type Preview = { revision: string; rows: ImportRow[] }
const actionNames = { add: 'Nowy', update: 'Zmiana', unchanged: 'Bez zmian' }
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
  const [importGroup, setImportGroup] = useState('Dary Ciemności')
  const [importSubgroup, setImportSubgroup] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const saved = library?.talents.find((t) => t.id === draft?.id)
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved))

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
  const groups = [...new Set(library?.talents.map((t) => t.group))].sort((a, b) => a.localeCompare(b, 'pl'))
  const subgroups = [...new Set(library?.talents.filter((t) => !group || t.group === group).map((t) => t.subgroup).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, 'pl'))
  const filtered = library?.talents.filter((t) => (!group || t.group === group) && (!subgroup || (subgroup === '__none' ? t.subgroup === null : t.subgroup === subgroup)) && searchable(`${t.name} ${t.flavorDescription} ${t.description} ${t.code || ''}`).includes(searchable(query))) || []
  const patch = (values: Partial<Talent>) => setDraft((current) => current ? { ...current, ...values } : null)

  async function save() {
    if (!draft || !library) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api<Library>('/api/talents/save', jsonPost({ talent: draft, revision: library.revision }))
      setLibrary(data); setDraft(data.talents.find((t) => t.id === draft.id) || null); setMessage('Zapisano talent.')
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
    if (!file || !importGroup.trim()) return
    setBusy(true); setError(''); setMessage(''); setPreview(null)
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Plik przekracza 8 MB.')
      const params = new URLSearchParams({ group: importGroup.trim(), subgroup: importSubgroup.trim() })
      const data = await api<Preview>(`/api/talents/import-preview?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      setPreview(data)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function confirmImport() {
    if (!preview) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await api<Library>('/api/talents/import', jsonPost({ revision: preview.revision, talents: preview.rows.map((r) => r.talent) }))
      const added = preview.rows.filter((r) => r.action === 'add').length
      const changed = preview.rows.filter((r) => r.action === 'update').length
      setLibrary(data); setDraft(data.talents.find((t) => t.id === draft?.id) || data.talents[0] || null)
      setPreview(null); setImportOpen(false); setFile(null); setGroup(''); setSubgroup(''); setQuery('')
      setMessage(`Import zakończony. Dodano: ${added}. Zaktualizowano: ${changed}.`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="talent-library">
      <header className="talent-header">
        <div>
          <a href="#dev" onClick={(event) => { if (busy || !canLeave()) event.preventDefault() }}>← WORKSHOP</a>
          <h1>Przegląd i import talentów</h1>
          <p>Wewnętrzna lista talentów · {library?.talents.length ?? '…'} talentów</p>
        </div>
        <div className="talent-actions">
          <button disabled={busy} onClick={() => void refresh()}>Odśwież listę</button>
          <button className="talent-primary" disabled={busy || !library} onClick={() => {
            if (!canLeave()) return
            setDraft(saved || null); setImportOpen(true); setPreview(null); setError(''); setMessage('')
          }}>Importuj XLS / XLSX</button>
        </div>
      </header>
      {error && <p className="talent-error" role="alert">{error}</p>}
      {message && <p className="talent-message" role="status">{message}</p>}
      {busy && <p role="status">Przetwarzanie…</p>}
      {importOpen ? (
        <section className="talent-import" aria-label="Import talentów">
          <h2>Import z arkusza</h2>
          <p>Podgląd nie zmienia listy. Zatwierdzenie doda nowe talenty i zaktualizuje wskazane poniżej. Nie usuwa talentów nieobecnych w arkuszu.</p>
          <p>Rozpoznajemy talent po kodzie, a gdy go brak — po nazwie, grupie i podgrupie. Nadane ID i kody pozostają zachowane.</p>
          <fieldset disabled={busy}>
            <div className="talent-import-fields">
              <label>Plik XLS lub XLSX<input type="file" accept=".xls,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null) }} /></label>
              <label>Grupa importowanych talentów<input value={importGroup} maxLength={200} onChange={(e) => { setImportGroup(e.target.value); setPreview(null) }} /></label>
              <label>Podgrupa (opcjonalna)<input value={importSubgroup} maxLength={200} onChange={(e) => { setImportSubgroup(e.target.value); setPreview(null) }} /></label>
            </div>
            <p>Kolumny: Nazwa talentu · Opis fabularny · Opis talentu · Ile razy można użyć · Kod. Jeden arkusz, do 8 MB.</p>
            <div className="talent-actions">
              <button disabled={!file || !importGroup.trim()} onClick={() => void prepareImport()}>Pokaż podgląd importu</button>
              <button onClick={() => { setImportOpen(false); setPreview(null); setError('') }}>Anuluj</button>
            </div>
            {preview && <div className="talent-import-preview">
              <h2>Podgląd importu</h2>
              <p>Nowe: {preview.rows.filter((r) => r.action === 'add').length} · Zmiany: {preview.rows.filter((r) => r.action === 'update').length} · Bez zmian: {preview.rows.filter((r) => r.action === 'unchanged').length}</p>
              {preview.rows.map(({ talent, action }) => <details key={talent.id}>
                <summary><span className={`talent-badge ${action}`}>{actionNames[action]}</span> {talent.name}</summary>
                <p>{talent.group}{talent.subgroup ? ` / ${talent.subgroup}` : ''} · Użycia na misję: {talent.usesPerMission} · Kod: {talent.code || 'brak'}</p>
                {talent.flavorDescription && <p className="talent-flavor">{talent.flavorDescription}</p>}
                <p className="talent-description">{talent.description}</p>
              </details>)}
              <button className="talent-primary" disabled={preview.rows.every((r) => r.action === 'unchanged')} onClick={() => void confirmImport()}>Zatwierdź import</button>
            </div>}
          </fieldset>
        </section>
      ) : library ? (
        <div className="talent-layout">
          <aside className="talent-sidebar" aria-label="Lista talentów">
            <label>Szukaj talentu<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nazwa, opis lub kod" /></label>
            <label>Grupa<select value={group} onChange={(e) => { setGroup(e.target.value); setSubgroup('') }}><option value="">Wszystkie grupy</option>{groups.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Podgrupa<select value={subgroup} onChange={(e) => setSubgroup(e.target.value)}><option value="">Wszystkie podgrupy</option><option value="__none">Bez podgrupy</option>{subgroups.map((value) => <option key={value}>{value}</option>)}</select></label>
            <p className="talent-muted">Wyniki: {filtered.length} / {library.talents.length}</p>
            <div className="talent-list">
              {filtered.map((talent) => <button key={talent.id} disabled={busy} aria-pressed={draft?.id === talent.id} onClick={() => {
                if (draft?.id === talent.id || !canLeave()) return
                setDraft(talent); setError(''); setMessage('')
              }}><strong>{talent.name}</strong><small>{talent.group}{talent.subgroup ? ` / ${talent.subgroup}` : ''}</small></button>)}
              {!filtered.length && <p>{library.talents.length ? 'Brak pasujących talentów.' : 'Lista jest pusta. Zaimportuj arkusz z talentami.'}</p>}
            </div>
          </aside>
          {draft ? <form className="talent-editor" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <div className="talent-editor-title"><h2>Edycja talentu</h2>{dirty && <span className="talent-badge update">Niezapisane zmiany</span>}</div>
            <fieldset disabled={busy}>
              <label>Nazwa talentu<input required maxLength={300} value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></label>
              <div className="talent-pair">
                <label>Grupa<input required maxLength={200} list="talent-groups" value={draft.group} onChange={(e) => patch({ group: e.target.value })} /><datalist id="talent-groups">{groups.map((value) => <option key={value} value={value} />)}</datalist></label>
                <label>Podgrupa (opcjonalna)<input maxLength={200} value={draft.subgroup || ''} onChange={(e) => patch({ subgroup: e.target.value || null })} /></label>
              </div>
              <label>Opis fabularny<textarea rows={5} maxLength={20000} value={draft.flavorDescription} onChange={(e) => patch({ flavorDescription: e.target.value })} /></label>
              <label>Opis talentu<textarea required rows={8} maxLength={20000} value={draft.description} onChange={(e) => patch({ description: e.target.value })} /></label>
              <div className="talent-pair">
                <label>Ile razy można użyć na misję<select value={draft.usesPerMission} onChange={(e) => patch({ usesPerMission: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label>Kod<input readOnly value={draft.code || ''} placeholder="Zostanie nadany przy wysyłce" /></label>
              </div>
              <p className="talent-muted">Grupa i podgrupa służą wyłącznie do zarządzania talentami.</p>
              <div className="talent-actions">
                <button type="submit" className="talent-primary" disabled={!dirty}>Zapisz talent</button>
                <button type="button" disabled={!dirty} onClick={() => { if (canLeave()) { setDraft(saved || null); setError('') } }}>Odrzuć zmiany</button>
              </div>
            </fieldset>
          </form> : <section className="talent-editor"><h2>Wybierz talent lub zaimportuj arkusz</h2></section>}
        </div>
      ) : !error && <p role="status">Wczytywanie talentów…</p>}
    </main>
  )
}
