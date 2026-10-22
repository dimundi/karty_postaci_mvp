import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './talent-library.css'
import './mailing-list.css'
import MailingPreview from './MailingPreview'

type Recipient = { id: string; email: string; orderId?: string; sequenceNumber?: number; createdAt: string; deliveryStatus: 'not_sent' | 'sending' | 'sent' | 'error'; talentId: string | null; code?: string; draftId?: string; deliveryError?: string | null }
type List = { schemaVersion: number; recipients: Recipient[] }
type ImportPreview = { draftId: string; added: number; skipped: number; errors: number; rows: { sourceRow: number; orderId: string; email: string; action: 'add' | 'skip' | 'error'; reason: string; sequenceNumber: number | null }[] }
async function importApi<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`/api/mailing-list/${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nie udało się zapisać danych.')
  return data as T
}
const jsonPost = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
async function api(options?: RequestInit): Promise<List> {
  const response = await fetch('/api/mailing-list', { cache: 'no-store', ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nie udało się obsłużyć listy mailingowej.')
  return data as List
}
const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
const statuses = { not_sent: 'Nie wysłano', sending: 'Wysyłanie', sent: 'Wysłano', error: 'Błąd wysyłki' }

function SentMaterials({ recipient }: { recipient: Recipient }) {
  const [imageError, setImageError] = useState(false)
  if (!recipient.draftId || !/^[a-f0-9-]{36}$/.test(recipient.draftId)) return <p role="alert">Brak zapisanych materiałów tej wysyłki.</p>
  const file = (name: string) => `/api/mailing-list/preview-file?id=${recipient.draftId}&file=${name}`
  return <section className="mailing-panel" aria-label="Materiały wysłanego talentu">
    <p>Kod: <strong>{recipient.code || '—'}</strong></p>
    <div className="talent-actions"><a href={file('talent.pdf')} target="_blank" rel="noreferrer">Otwórz PDF</a><a href={file('facebook.png')} target="_blank" rel="noreferrer">Otwórz grafikę</a></div>
    <div className="mailing-materials">
      <div><h2>Wysłana grafika</h2>{imageError ? <p role="alert">Nie udało się wczytać zapisanej grafiki.</p> : <img className="mailing-poster" src={file('facebook.png')} alt="Grafika wysłanego talentu" onError={() => setImageError(true)} />}</div>
      <div><h2>Wysłany PDF</h2><iframe title="PDF wysłanego talentu" src={file('talent.pdf')} /></div>
    </div>
  </section>
}

export default function MailingList() {
  const [list, setList] = useState<List | null>(null)
  const [email, setEmail] = useState('')
  const [query, setQuery] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [editing, setEditing] = useState<Recipient | null>(null)
  const [editedEmail, setEditedEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewRecipient, setPreviewRecipient] = useState<Recipient | null>(null)
  const [deliveryBusy, setDeliveryBusy] = useState(false)
  const [nextBusy, setNextBusy] = useState(false)
  const [autoPrepare, setAutoPrepare] = useState(false)
  const [nextError, setNextError] = useState('')
  const [viewingMaterials, setViewingMaterials] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const page = useRef<HTMLElement>(null)
  const listPosition = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (previewRecipient) page.current?.scrollTo(0, 0)
    else if (returnFocus.current) {
      returnFocus.current.focus({ preventScroll: true })
      page.current?.scrollTo(0, listPosition.current)
    }
  }, [previewRecipient])
  const busy = loading || saving
  useEffect(() => {
    let active = true
    void api().then((data) => { if (active) setList(data) }).catch((e: Error) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  async function refresh() {
    setLoading(true); setError(''); setMessage('')
    try { setList(await api()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  async function refreshDelivery() {
    try {
      const updated = await api()
      setList(updated)
      setPreviewRecipient((current) => current ? updated.recipients.find((r) => r.id === current.id) || current : null)
    } catch (e) { setError((e as Error).message) }
  }
  async function add() {
    if (busy || !list) return
    setSaving(true); setError(''); setMessage('')
    try {
      setList(await api({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }))
      setEmail(''); setQuery(''); setMessage('Dodano adres do listy mailingowej.')
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false); window.requestAnimationFrame(() => input.current?.focus()) }
  }
  async function send(recipient: Recipient) {
    if (busy) return
    listPosition.current = page.current?.scrollTop ?? 0
    returnFocus.current = document.activeElement as HTMLElement
    setViewingMaterials(false); setAutoPrepare(false); setNextError(''); setPreviewRecipient(recipient); setError(''); setMessage('')
  }
  function showMaterials(recipient: Recipient) {
    listPosition.current = page.current?.scrollTop ?? 0
    returnFocus.current = document.activeElement as HTMLElement
    setViewingMaterials(true); setNextError(''); setPreviewRecipient(recipient)
  }
  async function nextRecipient() {
    if (!previewRecipient || deliveryBusy || nextBusy) return
    const number = previewRecipient.sequenceNumber
    if (!number) { setNextError('Bieżący odbiorca nie ma numeru kolejnego.'); return }
    setNextBusy(true); setNextError('')
    try {
      const updated = await api()
      setList(updated)
      const next = updated.recipients.find((r) => r.sequenceNumber === number + 1)
      if (!next) throw new Error(`Brak odbiorcy o numerze ${number + 1}.`)
      if (next.deliveryStatus === 'sent' || next.deliveryStatus === 'sending') throw new Error(`Odbiorca nr ${number + 1} ma status „${statuses[next.deliveryStatus]}”.`)
      setAutoPrepare(true); setPreviewRecipient(next)
    } catch (e) { setNextError((e as Error).message) } finally { setNextBusy(false) }
  }
  async function prepareImport() {
    if (busy || !importFile) return
    setSaving(true); setError(''); setMessage(''); setImportPreview(null)
    try {
      if (importFile.size > 5 * 1024 * 1024) throw new Error('Plik CSV może mieć najwyżej 5 MB.')
      setImportPreview(await importApi<ImportPreview>('import-preview', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: importFile }))
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }
  async function confirmImport() {
    if (busy || !importPreview || importPreview.errors || !importPreview.added) return
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await importApi<{ list: List; added: number; skipped: number }>('import', jsonPost({ draftId: importPreview.draftId }))
      setList(result.list); setImportPreview(null); setImportFile(null); setQuery('')
      if (fileInput.current) fileInput.current.value = ''
      setMessage(`Import zakończony. Dodano: ${result.added}. Pominięto: ${result.skipped}.`)
    } catch (e) { setError((e as Error).message); setImportPreview(null) }
    finally { setSaving(false) }
  }
  async function saveEmail() {
    if (busy || !editing) return
    setSaving(true); setError(''); setMessage('')
    try {
      setList(await importApi<List>('edit', jsonPost({ id: editing.id, originalEmail: editing.email, email: editedEmail })))
      setEditing(null); setImportPreview(null); setMessage('Zapisano adres e-mail.')
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }
  const filtered = list?.recipients.filter((entry) => entry.email.includes(query.trim().toLowerCase())).slice().sort((a, b) => {
    const aFirst = a.sequenceNumber !== undefined && a.sequenceNumber >= 900
    const bFirst = b.sequenceNumber !== undefined && b.sequenceNumber >= 900
    return Number(bFirst) - Number(aFirst) || (a.sequenceNumber ?? Number.MAX_SAFE_INTEGER) - (b.sequenceNumber ?? Number.MAX_SAFE_INTEGER)
  }) || []
  return <main ref={page} className={`talent-library mailing-list${previewRecipient ? ' mailing-preview-page' : ''}`}>
    <div hidden={previewRecipient !== null}>
    <header className="talent-header">
      <div><a href="#dev">← WORKSHOP</a><h1>Lista mailingowa</h1><p>Odbiorcy unikalnych talentów · Adresów: {list?.recipients.length ?? '…'}</p></div>
      <div className="talent-actions"><button disabled={busy} onClick={() => void refresh()}>Odśwież listę</button><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Przeglądaj</button></div>
    </header>
    {error && <p className="talent-error" role="alert">{error}</p>}
    {message && <p className="talent-message" role="status">{message}</p>}
    {editing && <section className="mailing-panel mailing-edit" aria-label="Edycja adresu">
      <h2>Edytuj adres e-mail</h2>
      <p>Numer: {editing.sequenceNumber ?? '—'} · Zamówienie: {editing.orderId ?? '—'}</p>
      <form onSubmit={(event) => { event.preventDefault(); void saveEmail() }}>
        <label>Nowy adres e-mail<input autoFocus type="email" required maxLength={254} disabled={busy} value={editedEmail} onChange={(event) => setEditedEmail(event.target.value)} /></label>
        <div className="talent-actions"><button type="submit" disabled={busy}>Zapisz adres</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Anuluj edycję</button></div>
      </form>
    </section>}
    <div className="mailing-layout">
      <section className="mailing-panel" aria-label="Ręczne dodawanie adresu">
        <h2>Dodaj maila ręcznie</h2>
        <form onSubmit={(event) => { event.preventDefault(); void add() }}>
          <label>Adres e-mail<input ref={input} type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={busy || !list} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="adres@domena.pl" /></label>
          <button type="submit" className="talent-primary" disabled={busy || !list || !email.trim()}>{saving ? 'Zapisywanie…' : 'Dodaj adres'}</button>
        </form>
        <p className="talent-muted">Każdy adres zapisujemy tylko raz. Wielkość liter nie ma znaczenia.</p>
        <div className="mailing-import-note"><h3>Import z pliku</h3>
          <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="Plik CSV do importu" hidden disabled={busy} onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); setError(''); setMessage('') }} />
          <p role="status">{importFile ? `Wybrany plik: ${importFile.name}` : 'Wybierz plik CSV przyciskiem „Przeglądaj”.'}</p>
          <p>Wybór pliku nie importuje adresów. Sprawdź podgląd i zatwierdź zapis.</p>
          <button disabled={busy || !importFile || !list} onClick={() => void prepareImport()}>Pokaż podgląd importu</button>
        </div>
      </section>
      <section className="mailing-panel" aria-label="Zapisane adresy">
        <h2>Zapisane adresy</h2>
        <label>Szukaj adresu<input type="search" value={query} disabled={!list} onChange={(event) => setQuery(event.target.value)} placeholder="Wpisz adres lub jego fragment" /></label>
        {loading && <p role="status">Wczytywanie listy…</p>}
        {list && <>
          <p className="talent-muted">Wyniki: {filtered.length} / {list.recipients.length}</p>
          <p className="talent-muted">„Wyślij” otwiera podgląd. Przypisany talent i kod pozostają zapisane także po błędzie wysyłki.</p>
          {filtered.length ? <div className="mailing-table-scroll"><table><thead><tr><th scope="col">Nr</th><th scope="col">Zamówienie</th><th scope="col">Adres e-mail</th><th scope="col">Dodano</th><th scope="col">Status wysyłki</th><th scope="col">ID talentu</th><th scope="col">Kod</th><th scope="col">Działania</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.id}>
            <td>{entry.sequenceNumber ?? '—'}</td><td>{entry.orderId ?? '—'}</td><td className="mailing-email">{entry.email}</td><td className="mailing-date"><time dateTime={entry.createdAt}>{date.format(new Date(entry.createdAt))}</time></td>
            <td><span className={`mailing-status mailing-status-${entry.deliveryStatus}`}>{statuses[entry.deliveryStatus]}</span></td>
            <td className="mailing-talent-id">{entry.talentId || '—'}</td><td>{entry.code || '—'}</td>
            <td><div className="talent-actions"><button disabled={busy || !!entry.talentId || entry.deliveryStatus === 'sent' || entry.deliveryStatus === 'sending'} aria-label={`Edytuj ${entry.email}`} onClick={() => { setEditing(entry); setEditedEmail(entry.email); page.current?.scrollTo(0, 0); setError('') }}>Edytuj</button><button disabled={busy || entry.deliveryStatus === 'sent' || entry.deliveryStatus === 'sending'} aria-label={`Wyślij do ${entry.email}`} onClick={() => void send(entry)}>Wyślij</button>{entry.deliveryStatus === 'sent' && <button disabled={busy || !entry.draftId} aria-label={`Zobacz materiały dla ${entry.email}`} onClick={() => showMaterials(entry)}>Zobacz materiały</button>}</div></td>
          </tr>)}</tbody></table></div> : <p>{list.recipients.length ? 'Brak pasujących adresów.' : 'Lista jest pusta. Dodaj pierwszy adres e-mail.'}</p>}
        </>}
      </section>
    </div>
    {importPreview && <section className="mailing-panel mailing-import-preview" aria-label="Podgląd importu">
      <h2>Podgląd importu</h2>
      <p>Nowe: {importPreview.added} · Pominięte: {importPreview.skipped} · Błędy: {importPreview.errors}</p>
      {!!importPreview.errors && <p className="talent-error">Popraw błędy w pliku i przygotuj nowy podgląd. Żaden wpis nie zostanie zapisany, dopóki są błędy.</p>}
      <div className="talent-actions"><button disabled={busy || !!importPreview.errors || !importPreview.added} onClick={() => void confirmImport()}>Zatwierdź import</button><button disabled={busy} onClick={() => setImportPreview(null)}>Zamknij podgląd</button></div>
      <div className="mailing-table-scroll"><table><thead><tr><th>Rekord CSV</th><th>Nr</th><th>Zamówienie</th><th>Adres e-mail</th><th>Wynik</th></tr></thead><tbody>{importPreview.rows.map((row) => <tr key={row.sourceRow}>
        <td>{row.sourceRow}</td><td>{row.sequenceNumber ?? '—'}</td><td>{row.orderId}</td><td className="mailing-email">{row.email}</td><td>{row.action === 'add' ? 'Nowy' : row.action === 'skip' ? 'Pominięty' : 'Błąd'}{row.reason && `: ${row.reason}`}</td>
      </tr>)}</tbody></table></div>
    </section>}
    </div>
    {previewRecipient && <>
      <header className="talent-header">
        <button autoFocus disabled={deliveryBusy || nextBusy} onClick={() => setPreviewRecipient(null)}>← Wróć do listy</button><div><h1>{viewingMaterials ? 'Wysłane materiały' : 'Podgląd wysyłki'}</h1><p>Nr {previewRecipient.sequenceNumber ?? '—'} · {previewRecipient.email}</p></div>
        {!viewingMaterials && <button className="talent-primary" disabled={deliveryBusy || nextBusy} onClick={() => void nextRecipient()}>Kolejny</button>}
      </header>
      {nextError && <p className="talent-error" role="alert">{nextError}</p>}
      {viewingMaterials ? <SentMaterials recipient={previewRecipient} /> : <MailingPreview key={previewRecipient.id} recipient={previewRecipient} autoPrepare={autoPrepare} onDeliveryChange={() => void refreshDelivery()} onBusyChange={setDeliveryBusy} />}
    </>}
  </main>
}
