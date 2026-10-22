import { useEffect, useRef, useState } from 'react'

type Options = { groups: string[]; selectedGroups: string[]; talents: { id: string; name: string; group: string; subgroup: string | null }[] }
type Draft = { id: string; to: string; bcc: string; subject: string; talent: { name: string; group: string } }
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/mailing-list/${path}`, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nie udało się przygotować podglądu.')
  return data as T
}
export default function MailingPreview({ recipient, autoPrepare = false, onDeliveryChange, onBusyChange }: { recipient: { id: string; email: string; talentId?: string | null } | null; autoPrepare?: boolean; onDeliveryChange?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [talentId, setTalentId] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sent, setSent] = useState(false)
  const automaticallyPrepared = useRef(false)
  useEffect(() => {
    if (autoPrepare && !automaticallyPrepared.current) {
      automaticallyPrepared.current = true
      void prepare()
    }
  }, [autoPrepare])
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  useEffect(() => { void api<Options>('preview-options').then(setOptions).catch((e: Error) => setError(e.message)) }, [])
  useEffect(() => { setDraft(null); setError('') }, [recipient?.id])
  const available = options?.talents || []
  async function prepare() {
    setBusy(true); setError(''); setNotice(''); setDraft(null); setSent(false)
    try {
      if (recipient) setDraft(await api<Draft>('preview', { recipientId: recipient.id, talentId: talentId || null }))
      const updated = await api<Options>('preview-options'); setOptions(updated)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function send() {
    if (!draft || busy || sent) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api<{ message: string }>('preview-send', { draftId: draft.id })
      setSent(true); setNotice(result.message)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false); onDeliveryChange?.() }
  }
  const file = (name: string) => `/api/mailing-list/preview-file?id=${draft?.id}&file=${name}`
  return <section className="mailing-panel mailing-preview" aria-label="Podgląd nagrody">
    {error && <p className="talent-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="mailing-preview-controls">
    <div className="mailing-pool"><div><strong>Dary Ciemności / Ekskluzywne</strong><p>Wolnych talentów: {options ? available.length : '…'}</p></div></div>
    {recipient ? <>
      {recipient.talentId ? <p>Ponowienie użyje zapisanego talentu i kodu.</p> : <label>Talent<select disabled={busy} value={talentId} onChange={(event) => { setTalentId(event.target.value); setDraft(null) }}><option value="">Pierwszy wolny z podgrupy Ekskluzywne</option>{available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      <div className="talent-actions mailing-send-actions">
        <button className="talent-primary" disabled={busy || sent || (!available.length && !recipient.talentId)} onClick={() => void prepare()}>Przygotuj podgląd</button>
        <button className="talent-primary" disabled={!draft || busy || sent} onClick={() => void send()}>{sent ? 'Przekazano do SMTP' : 'Wyślij'}</button>
      </div>
    </> : <p>Kliknij „Wyślij” przy adresie, aby przygotować podgląd.</p>}
    </div>
    {busy && <p role="status">Przetwarzanie…</p>}
    {draft && <div>
      <p className="mailing-envelope"><strong>{draft.subject}</strong><span>Do: {draft.to} · BCC: {draft.bcc || 'Nie ustawiono'} · Grupa: {draft.talent.group}</span></p>
      <div className="talent-actions"><a href={file('talent.pdf')} target="_blank" rel="noreferrer">Otwórz PDF</a><a href={file('facebook.png')} target="_blank" rel="noreferrer">Otwórz grafikę</a></div>
      <div className="mailing-materials"><div><h3>Treść maila</h3><iframe title="Podgląd wiadomości" sandbox="" src={file('email.html')} /></div>
      <div><h3>Grafika do załączenia</h3><img className="mailing-poster" src={file('facebook.png')} alt={`Grafika talentu ${draft.talent.name}`} /></div></div>
    </div>}
  </section>
}
