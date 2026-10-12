import { useEffect, useState } from 'react'
export type GlobalDefinition = { id: string; type: string; label: string; kind: 'checkbox' | 'text'; aggregation?: 'checkedCount'; width: number; height: number; fontSize: number; markStyle: 'x' | 'v' }
type Library = { version: number; fields: GlobalDefinition[] }
const kinds = { checkbox: 'Checkbox', text: 'Tekst' }
const builtIn = ['heat', 'darkInstinct', 'factionAspect', 'talent', 'darkGift', 'characterName', 'clanName']
export default function GlobalFieldDefinitions({ onClose, onSaved }: { onClose: () => void; onSaved: (fields: GlobalDefinition[]) => void }) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [draft, setDraft] = useState<GlobalDefinition | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('Wczytywanie…')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { void fetch('/api/field-definitions').then(async (response) => {
    const result = await response.json(); if (!response.ok) throw new Error(result.error)
    setLibrary(result); setMessage('')
  }).catch((error: Error) => setMessage(error.message)) }, [])
  function patch(value: Partial<GlobalDefinition>) { setDraft((previous) => previous ? { ...previous, ...value } : null); setDirty(true) }
  function close() { if (!busy && (!dirty || window.confirm('Porzucić niezapisane zmiany definicji pola?'))) onClose() }
  async function save() {
    if (!library || !draft || busy) return
    const field = { ...draft, id: draft.id.trim(), label: draft.label.trim() }
    if (!field.label || !/^[a-z][a-z0-9_]*$/.test(field.id)) { setMessage('Podaj nazwę oraz ID: małe litery, cyfry i podkreślenia.'); return }
    if (library.fields.some((current) => current.id === field.id && current.id !== editingId)) { setMessage('Pole o tym ID już istnieje.'); return }
    if (!editingId) field.type = field.id
    if (field.kind === 'text') delete field.aggregation
    const next = { ...library, fields: editingId ? library.fields.map((current) => current.id === editingId ? field : current) : [...library.fields, field] }
    setBusy(true); setMessage('Zapisywanie…')
    try {
      const response = await fetch('/api/field-definitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setLibrary(result.library); onSaved(result.library.fields); setDraft(null); setDirty(false); setMessage('Zapisano definicję pola.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  return <div className="creator-dialog-backdrop" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close() }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); void save() }
  }}><section className="creator-metadata-dialog creator-definitions-dialog" role="dialog" aria-modal="true" aria-label="Definicja pól">
    <div className="creator-section-heading"><h2>Definicja pól</h2><button disabled={busy} onClick={close}>Zamknij</button></div>
    <p className="creator-hint">Biblioteka wspólna dla wszystkich projektów.</p><p className="creator-definition-status" role="status">{message}</p>
    {library && !draft && <><button className="creator-primary" onClick={() => { setEditingId(null); setDraft({ id: '', type: '', label: '', kind: 'checkbox', width: 14, height: 14, fontSize: 10, markStyle: 'x' }); setDirty(false); setMessage('') }}>Dodaj</button><div className="creator-definition-list">{library.fields.map((field) => <div className="creator-definition-row" key={field.id}><div><strong>{field.label}</strong><small>{field.id} · {kinds[field.kind]}{field.aggregation === 'checkedCount' ? ' · zliczanie zaznaczeń' : ''}</small></div><button aria-label={`Edytuj ${field.label}`} onClick={() => { setEditingId(field.id); setDraft({ ...field }); setDirty(false); setMessage('') }}>Edytuj</button></div>)}</div></>}
    {draft && <fieldset disabled={busy}><h3>{editingId ? 'Edytuj pole' : 'Dodaj pole'}</h3>
      <label>Nazwa<input autoFocus value={draft.label} onChange={(event) => patch({ label: event.target.value })} /></label>
      <label>ID<input value={draft.id} readOnly={editingId !== null} placeholder="np. nazwa_pola" onChange={(event) => patch({ id: event.target.value })} /></label>
      <label>Typ<select aria-label="Typ" disabled={editingId !== null && builtIn.includes(draft.type)} value={draft.kind} onChange={(event) => patch({ kind: event.target.value as GlobalDefinition['kind'] })}>{Object.entries(kinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
      {draft.kind === 'checkbox' && <label>Liczenie wartości<select value={draft.aggregation ?? ''} onChange={(event) => patch({ aggregation: event.target.value === 'checkedCount' ? 'checkedCount' : undefined })}><option value="">Niezależne zaznaczenie</option><option value="checkedCount">Liczba zaznaczonych wystąpień</option></select></label>}
      <div className="creator-numbers"><label>Szerokość (pt)<input type="number" min="1" max="595.27" step=".1" value={draft.width} onChange={(event) => patch({ width: Number(event.target.value) })} /></label><label>Wysokość (pt)<input type="number" min="1" max="841.88" step=".1" value={draft.height} onChange={(event) => patch({ height: Number(event.target.value) })} /></label></div>
      {draft.kind === 'checkbox' ? <label>Znak zaznaczenia<select value={draft.markStyle} onChange={(event) => patch({ markStyle: event.target.value as 'x' | 'v' })}><option value="x">×</option><option value="v">✓</option></select></label> : <label>Rozmiar czcionki<input type="number" min="1" max="200" value={draft.fontSize} onChange={(event) => patch({ fontSize: Number(event.target.value) })} /></label>}
      <div className="creator-actions"><button onClick={() => { setDraft(null); setDirty(false); setMessage('') }}>Anuluj</button><button className="creator-primary" onClick={() => void save()}>Zapisz</button></div>
    </fieldset>}
  </section></div>
}
