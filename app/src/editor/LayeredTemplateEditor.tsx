import { PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import formFontUrl from '../assets/fonts/NotoSans-Regular.ttf'
import GlobalFieldDefinitions, { GlobalDefinition } from './GlobalFieldDefinitions'
import './layered-editor.css'

const WIDTH = 595.2756
const HEIGHT = 841.8898
type FieldType = string
type Layer = { id: string; number: number; name?: string; visible: boolean; locked: boolean }
type Variant = { id: string; name: string; clanId: string }
type Element = {
  id: string; layerId: string; kind: 'image' | 'text' | 'field'
  x: number; y: number; width: number; height: number
  source: string; text: string; fontSize: number; fieldType: FieldType
  label: string; markStyle: 'x' | 'v'; outline: boolean; parentId?: string
  variantIds: string[]
  definitionId?: string
}
type Project = {
  version: 1; page: { format: 'A4'; width: number; height: number }
  clanName: string; clanId: string; layers: Layer[]; elements: Element[]; variants: Variant[]
  kind: 'clan' | 'archetype'
  view?: { selectedVariantId: string; visibleVariantIds: string[] }
}
type Asset = { name: string; url: string }
type Pending = { kind: Element['kind']; source?: string; definition?: GlobalDefinition }
const fieldLabels: Record<FieldType, string> = {
  factionAspect: 'Aspekt frakcji', heat: 'Żar', talent: 'Talent', darkInstinct: 'Mroczny instynkt', darkGift: 'Dary ciemności',
  characterName: 'Imię lub przydomek', clanName: 'Nazwa klanu',
}
const id = () => crypto.randomUUID()
const round = (value: number) => Math.round(value * 100) / 100
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const layerName = (layer: Layer) => layer.name?.trim() || String(layer.number)
function resolveField(element: Element, definitions: GlobalDefinition[]): Element {
  const definition = element.kind === 'field' && definitions.find((definition) => definition.id === element.definitionId)
  return definition ? { ...element, label: definition.label, fieldType: definition.type, width: definition.width, height: definition.height, fontSize: definition.fontSize, markStyle: definition.markStyle } : element
}
function LayerIcon({ kind }: { kind: 'eye' | 'eye-off' | 'lock' | 'unlock' | 'up' | 'down' | 'trash' | 'left' | 'right' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(kind === 'eye' || kind === 'eye-off') && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{kind === 'eye-off' && <><path d="m3 3 18 18" stroke="white" strokeWidth="4" /><path d="m3 3 18 18" /></>}</>}
    {(kind === 'lock' || kind === 'unlock') && <><rect x="5" y="10" width="14" height="11" rx="2" />{kind === 'lock' ? <path d="M8 10V6a4 4 0 0 1 8 0v4" /> : <path d="M8 10V6a4 4 0 0 1 8 0" />}<path d="M12 14v3" /></>}
    {kind === 'up' && <path d="M12 20V4m-6 6 6-6 6 6" />}
    {kind === 'down' && <path d="M12 4v16m-6-6 6 6 6-6" />}
    {kind === 'trash' && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    {kind === 'left' && <path d="m15 5-7 7 7 7" />}
    {kind === 'right' && <path d="m9 5 7 7-7 7" />}
  </svg>
}
function emptyProject(): Project {
  return { version: 1, kind: 'clan', page: { format: 'A4', width: WIDTH, height: HEIGHT }, clanName: '', clanId: '', layers: [{ id: id(), number: 0, name: '0', visible: true, locked: false }], elements: [], variants: [] }
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Nie udało się wykonać operacji.')
  return data as T
}

export default function LayeredTemplateEditor() {
  const [project, setProject] = useState<Project>(emptyProject)
  const projectRef = useRef(project)
  const undoHistory = useRef<Project[]>([])
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [projects, setProjects] = useState<string[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [layerId, setLayerId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomMode, setZoomMode] = useState<'width' | 'page' | 'manual'>('page')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [outputs, setOutputs] = useState(false)
  const [visibleVariants, setVisibleVariants] = useState<string[]>([])
  const [exportVariant, setExportVariant] = useState('')
  const [outputVariant, setOutputVariant] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeProject, setActiveProject] = useState(false)
  const [metadata, setMetadata] = useState<'project' | 'variant' | null>(null)
  const [generationOpen, setGenerationOpen] = useState(false)
  const [generationVariant, setGenerationVariant] = useState('')
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [definitionsOpen, setDefinitionsOpen] = useState(false)
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false)
  const [fieldDefinitions, setFieldDefinitions] = useState<GlobalDefinition[]>([])
  const [fieldPickerMessage, setFieldPickerMessage] = useState('')
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [layersCollapsed, setLayersCollapsed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const zoomAnchor = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(null)
  const drag = useRef<{ element: Element; x: number; y: number; resize: boolean; historySaved: boolean } | null>(null)
  const activeLayer = project.layers.find((layer) => layer.id === layerId) ?? project.layers[0]
  const variants = project.variants ?? []
  const isVisible = (element: Element) => !element.variantIds?.length || element.variantIds.some((variant) => visibleVariants.includes(variant))
  const selected = project.elements.find((element) => element.id === selectedId && isVisible(element))
  const variant = variants.find((variant) => variant.id === exportVariant)
  const textField = (type: FieldType) => fieldDefinitions.find((definition) => definition.type === type)?.kind === 'text' || ['darkGift', 'characterName', 'clanName'].includes(type)
  const availableFields = (fieldDefinitions.length ? fieldDefinitions.map((definition) => [definition.type, definition.label]) : Object.entries(fieldLabels)).filter(([type]) => !['factionAspect', 'heat', 'talent', 'darkInstinct', 'darkGift', 'characterName', 'clanName'].includes(type) || (project.kind === 'archetype' ? ['characterName', 'clanName'].includes(type) : !['characterName', 'clanName'].includes(type)))
  const selectedLayer = project.layers.find((layer) => layer.id === selected?.layerId)
  const canEdit = !busy && !selectedLayer?.locked

  function change(update: (previous: Project) => Project, recordHistory = true) {
    const previous = projectRef.current
    const next = update(previous)
    next.elements = next.elements.map((element) => resolveField(element, fieldDefinitions))
    if (recordHistory) {
      undoHistory.current.push(previous)
      if (undoHistory.current.length > 100) undoHistory.current.shift()
    }
    projectRef.current = next
    setProject(next); setDirty(true); setOutputs(false)
  }
  function undo() {
    if (busy || drag.current || metadata || generationOpen || definitionsOpen || fieldPickerOpen) return
    const previous = undoHistory.current.pop()
    if (!previous) return
    previous.elements = previous.elements.map((element) => resolveField(element, fieldDefinitions))
    projectRef.current = previous
    setProject(previous); setDirty(true); setOutputs(false); setPending(null); setMessage('')
    if (!previous.elements.some((element) => element.id === selectedId)) setSelectedId('')
    if (!previous.layers.some((layer) => layer.id === layerId)) setLayerId(previous.layers[0].id)
    const ids = new Set((previous.variants ?? []).map((variant) => variant.id))
    setVisibleVariants((current) => current.filter((id) => ids.has(id)))
    if (!ids.has(exportVariant)) setExportVariant(previous.variants?.[0]?.id ?? '')
  }
  function patchElement(patch: Partial<Element>) {
    if (!selected || !canEdit) return
    change((previous) => ({ ...previous, elements: previous.elements.map((element) => {
      if (element.id !== selected.id) return element
      const next = { ...element, ...patch }
      Object.assign(next, resolveField(next, fieldDefinitions))
      next.width = clamp(round(next.width), 1, WIDTH)
      next.height = clamp(round(next.height), 1, HEIGHT)
      next.x = clamp(round(next.x), 0, WIDTH - next.width)
      next.y = clamp(round(next.y), 0, HEIGHT - next.height)
      return next
    }) }))
  }
  async function refresh() {
    const results = await Promise.allSettled([api<Asset[]>('/api/card-assets'), api<string[]>('/api/card-projects')])
    if (results[0].status === 'fulfilled') setAssets(results[0].value)
    else setMessage(results[0].reason.message)
    if (results[1].status === 'fulfilled') setProjects(results[1].value)
    else setMessage(results[1].reason.message)
  }
  function syncDefinitions(definitions: GlobalDefinition[]) {
    setFieldDefinitions(definitions)
    const next = { ...projectRef.current, elements: projectRef.current.elements.map((element) => {
      const definition = element.kind === 'field' && definitions.find((definition) => definition.id === element.definitionId)
      return definition ? { ...element, label: definition.label, fieldType: definition.type, width: definition.width, height: definition.height, fontSize: definition.fontSize, markStyle: definition.markStyle } : element
    }) }
    projectRef.current = next; setProject(next)
  }
  useEffect(() => {
    void refresh()
    void api<{ fields: GlobalDefinition[] }>('/api/field-definitions').then((library) => syncDefinitions(library.fields)).catch((error: Error) => setMessage(error.message))
  }, [])
  useEffect(() => {
    if (!message.startsWith('Zapisano ')) return
    const timer = window.setTimeout(() => { setMessage(''); setOutputs(false) }, 5000)
    return () => window.clearTimeout(timer)
  }, [message])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey && !event.altKey) {
        const target = event.target as HTMLElement
        const textInput = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range'].includes(target.type)) || target.isContentEditable
        if (textInput) return
        event.preventDefault()
        if (!event.repeat) undo()
        return
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's' || event.altKey) return
      event.preventDefault()
      if (!busy && !event.repeat) void save(false)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [busy, name, project, projects, savedName, layerId, selectedId, exportVariant, visibleVariants, metadata, generationOpen, definitionsOpen, fieldPickerOpen])
  function changeZoom(value: number, clientX?: number, clientY?: number) {
    const workspace = workspaceRef.current
    const page = pageRef.current
    if (!workspace || !page || drag.current) return
    const viewport = workspace.getBoundingClientRect()
    const bounds = page.getBoundingClientRect()
    const x = clientX ?? viewport.left + workspace.clientWidth / 2
    const y = clientY ?? viewport.top + workspace.clientHeight / 2
    zoomAnchor.current = { x, y, pageX: (x - bounds.left) / zoom, pageY: (y - bounds.top) / zoom }
    setZoomMode('manual')
    setZoom(Math.round(clamp(value, .1, 4) * 1000) / 1000)
  }
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current
    const workspace = workspaceRef.current
    const page = pageRef.current
    if (!anchor || !workspace || !page) return
    const bounds = page.getBoundingClientRect()
    workspace.scrollLeft += bounds.left + anchor.pageX * zoom - anchor.x
    workspace.scrollTop += bounds.top + anchor.pageY * zoom - anchor.y
    zoomAnchor.current = null
  }, [zoom])
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? workspace.clientHeight : 1)
      changeZoom(zoom * Math.exp(-clamp(delta, -120, 120) * .002), event.clientX, event.clientY)
    }
    workspace.addEventListener('wheel', wheel, { passive: false })
    return () => workspace.removeEventListener('wheel', wheel)
  }, [zoom])
  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menuOpen])
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || zoomMode === 'manual') return
    const fit = () => {
      const width = (workspace.clientWidth - 40) / WIDTH
      const height = (workspace.clientHeight - 40) / HEIGHT
      setZoom(Math.max(.1, zoomMode === 'width' ? width : Math.min(width, height)))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(workspace)
    fit()
    return () => observer.disconnect()
  }, [zoomMode])
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  }, [dirty])

  async function openProject(value: string) {
    if (dirty && !window.confirm('Porzucić niezapisane zmiany?')) return false
    setBusy(true)
    try {
      const next = value ? await api<Project>(`/api/card-project?name=${encodeURIComponent(value)}`) : emptyProject()
      projectRef.current = next; undoHistory.current = []
      setProject(next); setName(value); setSavedName(value); setLayerId(next.layers[0].id)
      setActiveProject(true); setMenuOpen(false); setMetadata(null)
      setVisibleVariants(next.view?.visibleVariantIds ?? (next.variants ?? []).map((variant) => variant.id)); setExportVariant(next.view?.selectedVariantId ?? next.variants?.[0]?.id ?? '')
      setSelectedId(''); setPending(null); setDirty(false); setOutputs(false); setMessage('')
      return true
    } catch (error) { setMessage((error as Error).message); return false }
    finally { setBusy(false) }
  }
  async function save(exportPdf: boolean, variantToExport = '') {
    if (busy) return
    if (exportPdf && variants.length && !variants.some((variant) => variant.id === variantToExport)) { setMessage('Wybierz wariant do eksportu.'); return }
    let projectName = name.trim()
    if (!projectName) {
      const entered = window.prompt('Podaj nazwę projektu. Pliki zostaną zapisane w katalogu o tej nazwie.', project.clanId || '')
      if (entered === null) return
      projectName = entered.trim()
      if (!projectName) { window.alert('Nazwa projektu nie może być pusta.'); return }
    }
    if (projectName !== savedName && projects.includes(projectName) && !window.confirm('Projekt o tej nazwie już istnieje. Nadpisać go?')) return
    setName(projectName)
    setBusy(true); setPending(null); setMessage(exportPdf ? 'Generowanie HTML i PDF…' : 'Zapisywanie projektu…')
    try {
      const result = await api<{ directory: string; exportDirectory: string }>('/api/card-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectName, project: { ...project, view: { selectedVariantId: exportVariant, visibleVariantIds: visibleVariants } }, exportPdf, variantId: variantToExport }),
      })
      setSavedName(projectName); setDirty(false); setOutputs(exportPdf)
      setActiveProject(true)
      setOutputVariant(variantToExport)
      if (exportPdf) setGenerationOpen(false)
      setMessage(exportPdf ? `Zapisano projekt.json w ${result.directory}; karta.html, karta.pdf i pola.json w cardTemplates/${result.exportDirectory}.` : `Zapisano projekt.json w ${result.directory}.`)
      await refresh()
    } catch (error) { setMessage((error as Error).message); window.alert(`Nie udało się zapisać projektu.\n${(error as Error).message}`) }
    finally { setBusy(false) }
  }
  function patchLayer(targetId: string, patch: Partial<Layer>) {
    change((previous) => ({ ...previous, layers: previous.layers.map((layer) => layer.id === targetId ? { ...layer, ...patch } : layer) }))
    setPending(null)
  }
  function addVariant() {
    if (!activeProject || busy) return
    const value = window.prompt('Nazwa nowego wariantu:')
    if (!value?.trim()) return
    const next: Variant = { id: id(), name: value.trim(), clanId: value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
    change((previous) => ({ ...previous, variants: [...(previous.variants ?? []), next] }))
    setVisibleVariants((previous) => [...previous, next.id]); setExportVariant(next.id); setPending(null)
  }
  function patchVariant(patch: Partial<Variant>) {
    change((previous) => ({ ...previous, variants: previous.variants.map((current) => current.id === exportVariant ? { ...current, ...patch } : current) }))
  }
  function moveLayer(targetId: string, direction: number) {
    const index = project.layers.findIndex((layer) => layer.id === targetId)
    const next = index + direction
    if (next < 0 || next >= project.layers.length) return
    change((previous) => {
      const layers = previous.layers.map((layer) => ({ ...layer, name: layerName(layer) }))
      ;[layers[index], layers[next]] = [layers[next], layers[index]]
      return { ...previous, layers: layers.map((layer, number) => ({ ...layer, number })) }
    })
  }
  function prepare(value: Pending) {
    if (activeLayer.locked || !activeLayer.visible) { setMessage('Wybierz widoczną, odblokowaną warstwę.'); return }
    setPending(value); setSelectedId(''); setMessage('Kliknij na stronie, aby umieścić element. Esc anuluje.')
  }
  async function chooseField() {
    if (activeLayer.locked || !activeLayer.visible) { setMessage('Wybierz widoczną, odblokowaną warstwę.'); return }
    setFieldPickerOpen(true); setFieldPickerMessage('Wczytywanie…')
    try {
      const library = await api<{ fields: GlobalDefinition[] }>('/api/field-definitions')
      setFieldDefinitions(library.fields); setFieldPickerMessage('')
    } catch (error) { setFieldPickerMessage((error as Error).message) }
  }
  async function place(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pending || busy || activeLayer.locked || !activeLayer.visible || !pageRef.current) return
    const rect = pageRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / zoom
    const y = (event.clientY - rect.top) / zoom
    const item = pending
    setPending(null)
    let width = item.kind === 'field' ? 14 : 180
    let height = item.kind === 'field' ? 14 : 50
    if (item.kind === 'image') {
      try {
        const image = new Image()
        image.src = assets.find((asset) => asset.name === item.source)!.url
        await image.decode()
        width = Math.min(250, WIDTH - x)
        height = width * image.naturalHeight / image.naturalWidth
        if (height > HEIGHT - y) { height = HEIGHT - y; width = height * image.naturalWidth / image.naturalHeight }
      } catch { setMessage('Nie udało się wczytać grafiki.'); return }
    }
    const element: Element = {
      id: id(), layerId: activeLayer.id, kind: item.kind, source: item.source ?? '', text: '',
      x: round(clamp(x, 0, WIDTH - width)), y: round(clamp(y, 0, HEIGHT - height)), width: round(width), height: round(height),
      fontSize: 10, fieldType: 'factionAspect', label: '', markStyle: 'x', outline: false,
      variantIds: variant ? [variant.id] : [],
    }
    if (item.kind === 'field' && item.definition) {
      element.fieldType = item.definition.type; element.definitionId = item.definition.id; element.label = item.definition.label
      element.width = item.definition.width; element.height = item.definition.height; element.fontSize = item.definition.fontSize; element.markStyle = item.definition.markStyle
      element.x = clamp(element.x, 0, WIDTH - element.width); element.y = clamp(element.y, 0, HEIGHT - element.height)
    }
    change((previous) => ({ ...previous, elements: [...previous.elements, element] }))
    setSelectedId(element.id); setMessage('')
  }
  function startDrag(event: ReactPointerEvent, element: Element, resize = false) {
    if (pending) return
    event.stopPropagation()
    if (busy) return
    setSelectedId(element.id); setLayerId(element.layerId)
    if (project.layers.find((layer) => layer.id === element.layerId)?.locked) return
    drag.current = { element, x: event.clientX, y: event.clientY, resize, historySaved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onMove(event: ReactPointerEvent) {
    if (!drag.current) return
    const { element, x, y, resize } = drag.current
    const dx = (event.clientX - x) / zoom, dy = (event.clientY - y) / zoom
    if (!dx && !dy) return
    const patch = resize
      ? { width: round(clamp(element.width + dx, 1, WIDTH - element.x)), height: round(clamp(element.height + dy, 1, HEIGHT - element.y)) }
      : { x: round(clamp(element.x + dx, 0, WIDTH - element.width)), y: round(clamp(element.y + dy, 0, HEIGHT - element.height)) }
    change((previous) => ({ ...previous, elements: previous.elements.map((current) => current.id === element.id ? { ...current, ...patch } : current) }), !drag.current.historySaved)
    drag.current.historySaved = true
  }
  function deleteElement(element: Element) {
    if (busy || project.layers.find((layer) => layer.id === element.layerId)?.locked) return
    change((previous) => ({ ...previous, elements: previous.elements.filter((current) => current.id !== element.id).map((current) => current.parentId === element.id ? { ...current, parentId: undefined } : current) }))
    if (selectedId === element.id) setSelectedId('')
  }
  function reorderElement(element: Element, direction: number) {
    if (busy || project.layers.find((layer) => layer.id === element.layerId)?.locked) return
    const sameLayer = project.elements.filter((current) => current.layerId === element.layerId)
    const index = sameLayer.findIndex((current) => current.id === element.id)
    const other = sameLayer[index + direction]
    if (!other) return
    change((previous) => {
      const elements = [...previous.elements]
      const a = elements.findIndex((current) => current.id === element.id), b = elements.findIndex((current) => current.id === other.id)
      ;[elements[a], elements[b]] = [elements[b], elements[a]]
      return { ...previous, elements }
    })
  }

  return <main className="card-creator" onKeyDown={(event) => { if (event.key === 'Escape') { setPending(null); setMessage(''); setMenuOpen(false); setMetadata(null); setAssetPickerOpen(false); setFieldPickerOpen(false); if (!busy) setGenerationOpen(false) } }}>
    <style>{`@font-face{font-family:CardFont;src:url("${formFontUrl}")}`}</style>
    <header className="creator-header">
      <div className="creator-title"><div ref={menuRef} className="creator-main-menu">
        <button className="creator-menu-toggle" aria-label="Menu kreatora" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((previous) => !previous)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg></button>
        {menuOpen && <div className="creator-menu-dropdown" role="menu">
          <button role="menuitem" disabled={busy} onClick={async () => { setMenuOpen(false); if (await openProject('')) setMetadata('project') }}>Utwórz projekt</button>
          <button role="menuitem" disabled={busy || !activeProject} onClick={() => { setMenuOpen(false); addVariant() }}>Utwórz wariant</button>
          <hr />
          <button role="menuitem" disabled={busy || !activeProject} onClick={() => { setMetadata('project'); setMenuOpen(false) }}>Metryka projektu</button>
          <button role="menuitem" disabled={busy || !variant} onClick={() => { setMetadata('variant'); setMenuOpen(false) }}>Metryka wariantu</button>
          <button role="menuitem" disabled={busy} onClick={() => { setDefinitionsOpen(true); setMenuOpen(false) }}>Definicja pól</button>
          <hr /><a role="menuitem" href="#dev" onClick={(event) => { if (dirty && !window.confirm('Porzucić niezapisane zmiany?')) event.preventDefault() }}>Tryb deweloperski</a>
          <hr />
          <button role="menuitem" disabled={busy} onClick={() => { setMenuOpen(false); void save(false) }}><span>Zapisz projekt</span><kbd>Ctrl+S</kbd></button>
        </div>}
      </div><h1>Kreator szablonów</h1><span>A4{dirty ? ' · Zmiany' : ''}</span></div>
      <div className="creator-project-tools">
        <label className="creator-export-picker">Projekt<select aria-label="Otwórz projekt" disabled={busy} value={savedName} onChange={(event) => { if (event.target.value) void openProject(event.target.value) }}><option value="">{activeProject ? 'Niezapisany projekt' : 'Wybierz projekt'}</option>{projects.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="creator-actions"><button className="creator-primary" disabled={busy} onClick={() => { if (!variants.length) void save(true); else { setGenerationVariant(''); setGenerationOpen(true) } }}>{busy ? 'Praca…' : 'Generuj HTML + PDF + JSON'}</button></div>
    </header>
    {definitionsOpen && <GlobalFieldDefinitions onClose={() => setDefinitionsOpen(false)} onSaved={syncDefinitions} />}
    {fieldPickerOpen && <div className="creator-dialog-backdrop"><section className="creator-metadata-dialog creator-definitions-dialog" role="dialog" aria-modal="true" aria-label="Wybierz pole">
      <div className="creator-section-heading"><h2>Wybierz pole</h2><button onClick={() => setFieldPickerOpen(false)}>Zamknij</button></div><p className="creator-hint">Definicje wspólne dla wszystkich projektów.</p><p role="status">{fieldPickerMessage}</p>
      {!fieldPickerMessage && <div className="creator-field-picker-list">{availableFields.map(([type]) => { const definition = fieldDefinitions.find((definition) => definition.type === type)!; return <button key={definition.id} onClick={() => { prepare({ kind: 'field', definition }); setFieldPickerOpen(false) }}><strong>{definition.label}</strong><small>{definition.id} · {definition.kind === 'text' ? 'Tekst' : 'Checkbox'}{definition.aggregation === 'checkedCount' ? ' · zliczanie zaznaczeń' : ''}</small></button> })}</div>}
    </section></div>}
    {assetPickerOpen && <div className="creator-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setAssetPickerOpen(false) }}><section className="creator-metadata-dialog creator-asset-picker" role="dialog" aria-modal="true" aria-label="Pliki z katalogu Links">
      <div className="creator-section-heading"><h2>Links</h2><button aria-label="Zamknij wybór obrazu" onClick={() => setAssetPickerOpen(false)}>Zamknij</button></div>
      <button disabled={busy} onClick={() => void refresh()}>Odśwież listę plików</button>
      {!assets.length && <p className="creator-hint">Brak grafik w katalogu Links.</p>}
      <div className="creator-assets">{assets.map((asset) => <button key={asset.name} disabled={busy} onClick={() => { prepare({ kind: 'image', source: asset.name }); setAssetPickerOpen(false) }}><img src={asset.url} alt="" /><span>{asset.name}</span></button>)}</div>
    </section></div>}
    {generationOpen && <div className="creator-dialog-backdrop"><section className="creator-metadata-dialog" role="dialog" aria-modal="true" aria-label="Generowanie szablonu"><h2>Generowanie szablonu</h2><fieldset disabled={busy}>
      <label>Wariant do eksportu<select autoFocus value={generationVariant} onChange={(event) => setGenerationVariant(event.target.value)}><option value="">Wybierz wariant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>
      <div className="creator-actions"><button onClick={() => setGenerationOpen(false)}>Anuluj</button><button className="creator-primary" disabled={!generationVariant} onClick={() => void save(true, generationVariant)}>{busy ? 'Generowanie…' : 'Generuj wariant'}</button></div>
    </fieldset></section></div>}
    {metadata && <div className="creator-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setMetadata(null) }}><section className="creator-metadata-dialog" role="dialog" aria-modal="true" aria-label={metadata === 'project' ? 'Metryka projektu' : 'Metryka wariantu'}><div className="creator-section-heading"><h2>{metadata === 'project' ? 'Metryka projektu' : 'Metryka wariantu'}</h2><button aria-label="Zamknij metrykę" onClick={() => setMetadata(null)}>Zamknij</button></div><fieldset disabled={busy}>
      {metadata === 'project' ? <>
        <label>Katalog projektu<input autoFocus value={name} placeholder="np. Klany lub Archetypy" onChange={(event) => { setName(event.target.value); setDirty(true); setOutputs(false) }} /></label>
        <label>Typ karty<select value={project.kind ?? 'clan'} onChange={(event) => change((previous) => ({ ...previous, kind: event.target.value as Project['kind'] }))}><option value="clan">Klan</option><option value="archetype">Archetyp</option></select></label>
        <label>Nazwa projektu<input value={project.clanName} onChange={(event) => change((previous) => ({ ...previous, clanName: event.target.value }))} /></label>
        <label>Identyfikator projektu<input value={project.clanId} onChange={(event) => change((previous) => ({ ...previous, clanId: event.target.value }))} /></label>
      </> : variant && <><label>Nazwa wariantu<input autoFocus value={variant.name} onChange={(event) => patchVariant({ name: event.target.value })} /></label><label>Identyfikator wariantu<input value={variant.clanId} onChange={(event) => patchVariant({ clanId: event.target.value })} /></label></>}
    </fieldset></section></div>}
    {(message || outputs) && <div className="creator-notification">
      <button className="creator-notification-close" aria-label="Zamknij komunikat" onClick={() => { setMessage(''); setOutputs(false) }}>Zamknij</button>
      <p className="creator-message" role="status">{message}</p>
      {outputs && <div className="creator-downloads">{['karta.html', 'karta.pdf', 'pola.json', 'projekt.json'].map((file) => <a key={file} href={`/api/card-output?name=${encodeURIComponent(savedName)}&file=${file}&variant=${encodeURIComponent(outputVariant)}`} target="_blank" rel="noreferrer">{file}</a>)}</div>}
    </div>}
    <div className={`creator-layout ${propertiesCollapsed ? 'properties-collapsed' : ''} ${layersCollapsed ? 'layers-collapsed' : ''}`}>
      <aside className="creator-panel creator-library"><fieldset disabled={busy}>
        <div className="creator-section-heading"><h2>Dodaj element</h2></div>
        <div className="creator-add-tools"><button className="creator-add-image" aria-label="Obraz" title="Wybierz obraz z Links" onClick={() => { setAssetPickerOpen(true); void refresh() }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg><span>Obraz</span></button><button className="creator-add-image" onClick={() => prepare({ kind: 'text' })}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6V4h16v2M12 4v16M8 20h8" /></svg><span>Tekst</span></button><button className="creator-add-image" onClick={() => void chooseField()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1" /></svg><span>Pole</span></button></div>
      </fieldset></aside>
      <section className="creator-preview">
        <div className="creator-toolbar"><div className="creator-zoom-controls"><button aria-label="Oddal kartę" title="Oddal" disabled={zoom <= .1} onClick={() => changeZoom(zoom / 1.2)}>−</button><label>Powiększenie <select value={zoomMode === 'manual' ? String(zoom) : zoomMode} onChange={(event) => { const value = event.target.value; if (value === 'width' || value === 'page') { zoomAnchor.current = null; setZoomMode(value) } else changeZoom(Number(value)) }}><option value="width">Szerokość</option><option value="page">Cała strona</option>{zoomMode === 'manual' && ![.5, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4].includes(zoom) && <option value={zoom}>{Math.round(zoom * 100)}%</option>}{[.5, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4].map((value) => <option key={value} value={value}>{value * 100}%</option>)}</select></label><button aria-label="Przybliż kartę" title="Przybliż" disabled={zoom >= 4} onClick={() => changeZoom(zoom * 1.2)}>+</button><span className="creator-zoom-hint">Ctrl + kółko</span></div><span>Warstwa {layerName(activeLayer)}{pending ? ' · Kliknij miejsce na stronie' : ''}</span></div>
        <div ref={workspaceRef} className="creator-page-scroll"><div className="creator-page-container" style={{ width: WIDTH * zoom, height: HEIGHT * zoom }}>
          <div ref={pageRef} className={`creator-page ${pending ? 'placing' : ''}`} style={{ width: WIDTH, height: HEIGHT, transform: `scale(${zoom})` }} onPointerDown={(event) => { if (pending) void place(event); else setSelectedId('') }}>
            {project.layers.filter((layer) => layer.visible).map((layer) => <div key={layer.id} className="creator-layer">
              {project.elements.filter((element) => element.layerId === layer.id && isVisible(element)).map((element) => <div key={element.id} className={`creator-element ${element.kind} ${selectedId === element.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`} style={{ left: element.x, top: element.y, width: element.width, height: element.height, fontSize: element.fontSize, border: element.kind === 'field' && element.outline ? '.7px solid #111' : undefined, pointerEvents: pending ? 'none' : undefined }} onPointerDown={(event) => startDrag(event, element)} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
                {element.kind === 'image' && <img draggable={false} src={assets.find((asset) => asset.name === element.source)?.url ?? `/api/card-asset?file=${encodeURIComponent(element.source)}`} alt={element.source} />}
                {element.kind === 'text' && <div className="creator-text">{element.text || <span className="creator-placeholder">Wpisz tekst we właściwościach</span>}</div>}
                {element.kind === 'field' && <span className="creator-field-label">{element.label || fieldLabels[element.fieldType]}</span>}
                {selectedId === element.id && !layer.locked && element.kind !== 'field' && <button aria-label="Zmień rozmiar" className="creator-resize" onPointerDown={(event) => startDrag(event, element, true)} />}
              </div>)}
            </div>)}
          </div>
        </div></div>
      </section>
      <aside className={`creator-panel creator-layer-panel ${layersCollapsed ? 'is-collapsed' : ''}`}>
        <div className="creator-panel-heading"><span>Warstwy i warianty</span><button title={layersCollapsed ? 'Rozwiń warstwy' : 'Zwiń warstwy'} aria-label={layersCollapsed ? 'Rozwiń warstwy' : 'Zwiń warstwy'} aria-expanded={!layersCollapsed} onClick={() => setLayersCollapsed((previous) => !previous)}><LayerIcon kind={layersCollapsed ? 'left' : 'right'} /></button></div>
        <div hidden={layersCollapsed}><fieldset disabled={busy}>
          <details className="creator-fold" open><summary>Warianty</summary>
          <div className="creator-variant-list">{variants.map((current) => <div key={current.id} className={`creator-variant-row ${exportVariant === current.id ? 'active' : ''}`}>
            <button aria-label={`Wybierz wariant ${current.name}`} aria-pressed={exportVariant === current.id} title={current.name} onClick={() => { setExportVariant(current.id); setVisibleVariants([current.id]); setPending(null) }}>{current.name}</button>
            <label title="Pokaż w podglądzie"><input type="checkbox" aria-label={`Podgląd wariantu ${current.name}`} checked={visibleVariants.includes(current.id)} onChange={(event) => { setVisibleVariants((previous) => event.target.checked ? [...previous, current.id] : previous.filter((id) => id !== current.id)); setPending(null) }} /></label>
          </div>)}</div>
          {!variants.length && <p className="creator-hint">Dodaj wariant przez menu kreatora.</p>}
          </details>
        <details className="creator-fold" open><summary><span>Warstwy</span><button aria-label="Dodaj warstwę" onClick={(event) => { event.preventDefault(); event.stopPropagation(); const next = { id: id(), number: project.layers.length, name: String(project.layers.length), visible: true, locked: false }; change((previous) => ({ ...previous, layers: [...previous.layers, next] })); setLayerId(next.id); setSelectedId(''); setPending(null) }}>+</button></summary>
        <div className="creator-layers">{[...project.layers].reverse().map((layer) => <div key={layer.id} className={activeLayer.id === layer.id ? 'active' : ''}>
          <button className="creator-layer-select" title="Dwukrotne kliknięcie: zmień nazwę" aria-label={`Wybierz warstwę ${layerName(layer)}`} aria-pressed={activeLayer.id === layer.id} onClick={() => { setLayerId(layer.id); setPending(null); setSelectedId('') }} onDoubleClick={() => { if (busy) return; const value = window.prompt('Nazwa warstwy:', layerName(layer)); if (value?.trim()) patchLayer(layer.id, { name: value.trim().slice(0, 100) }) }}>{layerName(layer)}</button>
          <button className="creator-layer-icon" title={layer.visible ? 'Ukryj warstwę' : 'Pokaż warstwę'} aria-label={`Widoczność warstwy ${layerName(layer)}`} aria-pressed={layer.visible} onClick={() => patchLayer(layer.id, { visible: !layer.visible })}><LayerIcon kind={layer.visible ? 'eye' : 'eye-off'} /></button>
          <button className={`creator-layer-icon creator-layer-lock ${layer.locked ? 'is-locked' : 'is-unlocked'}`} title={layer.locked ? 'Odblokuj warstwę' : 'Zablokuj warstwę'} aria-label={`Blokada warstwy ${layerName(layer)}`} aria-pressed={layer.locked} onClick={() => patchLayer(layer.id, { locked: !layer.locked })}><LayerIcon kind="lock" /></button>
          <button className="creator-layer-icon" title="Przenieś wyżej" aria-label={`Przenieś warstwę ${layerName(layer)} wyżej`} disabled={project.layers.at(-1)?.id === layer.id} onClick={() => moveLayer(layer.id, 1)}><LayerIcon kind="up" /></button>
          <button className="creator-layer-icon" title="Przenieś niżej" aria-label={`Przenieś warstwę ${layerName(layer)} niżej`} disabled={project.layers[0].id === layer.id} onClick={() => moveLayer(layer.id, -1)}><LayerIcon kind="down" /></button>
        </div>)}</div>
        </details>
      </fieldset><h2>Elementy warstwy {layerName(activeLayer)}</h2>
        <div className="creator-element-list">{project.elements.filter((element) => element.layerId === activeLayer.id && isVisible(element)).reverse().map((element) => {
          const label = element.kind === 'image' ? element.source : element.kind === 'text' ? element.text || 'Tekst' : element.label || fieldLabels[element.fieldType]
          const sameLayer = project.elements.filter((current) => current.layerId === element.layerId)
          const index = sameLayer.findIndex((current) => current.id === element.id)
          return <div key={element.id} className={`creator-object-row ${selectedId === element.id ? 'active' : ''}`}>
            <button className="creator-object-select" title={label} disabled={busy} onClick={() => { setSelectedId(element.id); setPending(null) }}>{label}</button>
            <button className="creator-object-icon" title="Na wierzch o jeden element" aria-label={`Przenieś wyżej: ${label}`} disabled={busy || activeLayer.locked || index === sameLayer.length - 1} onClick={() => reorderElement(element, 1)}><LayerIcon kind="up" /></button>
            <button className="creator-object-icon" title="Pod spód o jeden element" aria-label={`Przenieś niżej: ${label}`} disabled={busy || activeLayer.locked || index === 0} onClick={() => reorderElement(element, -1)}><LayerIcon kind="down" /></button>
            <button className="creator-object-icon creator-danger" title="Usuń element" aria-label={`Usuń element: ${label}`} disabled={busy || activeLayer.locked} onClick={() => deleteElement(element)}><LayerIcon kind="trash" /></button>
          </div>
        })}</div></div>
      </aside>
      <aside className={`creator-panel creator-properties ${propertiesCollapsed ? 'is-collapsed' : ''}`}>
        <div className="creator-panel-heading"><h2>Właściwości</h2><button title={propertiesCollapsed ? 'Rozwiń właściwości' : 'Zwiń właściwości'} aria-label={propertiesCollapsed ? 'Rozwiń właściwości' : 'Zwiń właściwości'} aria-expanded={!propertiesCollapsed} onClick={() => setPropertiesCollapsed((previous) => !previous)}><LayerIcon kind={propertiesCollapsed ? 'left' : 'right'} /></button></div>
        <div hidden={propertiesCollapsed}>
        {!selected ? <p className="creator-hint">Wybierz element na stronie lub z listy.</p> : <fieldset disabled={!canEdit}>
          {selectedLayer?.locked && <p className="creator-hint">Warstwa jest zablokowana.</p>}
          <details className="creator-fold" open><summary>Pozycja</summary>
          <div className="creator-numbers">{(['x', 'y'] as const).map((key) => <label key={key}>{key.toUpperCase()} (pt)<input type="number" step=".1" value={selected[key]} onChange={(event) => { if (event.target.value) patchElement({ [key]: Number(event.target.value) }) }} /></label>)}</div>
          </details>
          <details className="creator-fold" open><summary>Rozmiar</summary>
          <div className="creator-numbers">{(['width', 'height'] as const).map((key) => <label key={key}>{key === 'width' ? 'Szerokość' : 'Wysokość'} (pt)<input type="number" step=".1" value={selected[key]} readOnly={selected.kind === 'field'} onChange={(event) => { if (event.target.value) patchElement({ [key]: Number(event.target.value) }) }} /></label>)}</div>
          {selected.kind === 'image' && <button onClick={() => patchElement({ x: 0, y: 0, width: WIDTH, height: HEIGHT })}>Dopasuj do strony A4</button>}
          </details>
          {selected.kind !== 'image' && <details className="creator-fold" open><summary>{selected.kind === 'text' ? 'Tekst' : 'Pole'}</summary>
          {selected.kind === 'text' && <label>Treść<textarea rows={6} value={selected.text} onChange={(event) => patchElement({ text: event.target.value })} /></label>}
          <label>Rozmiar czcionki<input type="number" min="1" max="200" value={selected.fontSize} readOnly={selected.kind === 'field'} onChange={(event) => { if (event.target.value) patchElement({ fontSize: clamp(Number(event.target.value), 1, 200) }) }} /></label>
          {selected.kind === 'field' && <>
            <p className="creator-hint">Nazwa, rozmiar i znak zaznaczenia pochodzą z globalnej definicji. Zmienisz je w menu „Definicja pól”.</p>
            <label>Typ pola<select value={selected.fieldType} onChange={(event) => { const type = event.target.value as FieldType; patchElement({ fieldType: type, definitionId: fieldDefinitions.find((definition) => definition.type === type)?.id, markStyle: type === 'talent' ? 'v' : 'x', ...(textField(type) ? { width: 180, height: type === 'darkGift' ? 60 : 18 } : { width: 14, height: 14 }) }) }}>{!availableFields.some(([type]) => type === selected.fieldType) && <option value={selected.fieldType}>{fieldLabels[selected.fieldType]}</option>}{availableFields.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
            <label>Nazwa pola<input value={selected.label} readOnly onChange={(event) => patchElement({ label: event.target.value })} /></label>
            {!textField(selected.fieldType) && <label>Znak zaznaczenia<select disabled value={selected.markStyle} onChange={(event) => patchElement({ markStyle: event.target.value as 'x' | 'v' })}><option value="x">×</option><option value="v">✓</option></select></label>}
            {selected.fieldType === 'talent' && <label>Aspekt frakcji<select value={selected.parentId ?? ''} onChange={(event) => patchElement({ parentId: event.target.value || undefined })}><option value="">Bez przypisania</option>{project.elements.filter((element) => element.kind === 'field' && element.fieldType === 'factionAspect').map((element) => <option key={element.id} value={element.id}>{element.label || 'Aspekt frakcji'}</option>)}</select></label>}
            <label className="creator-check"><input type="checkbox" checked={selected.outline} onChange={(event) => patchElement({ outline: event.target.checked })} />Drukuj obramowanie pola</label>
            <p className="creator-hint">Kolorowe oznaczenia i etykiety pól służą tylko do edycji. Nie trafią do PDF-u.</p>
          </>}
          </details>}
          <details className="creator-fold" open><summary>Warstwa</summary>
          <label>Warstwa<select value={selected.layerId} onChange={(event) => { patchElement({ layerId: event.target.value }); setLayerId(event.target.value) }}>{project.layers.map((layer) => <option key={layer.id} value={layer.id}>{layerName(layer)}</option>)}</select></label>
          </details>
          {variants.length > 0 && <details className="creator-fold" open><summary>Warianty elementu</summary><div className="creator-variant-assignment"><p className="creator-hint">Bez zaznaczeń: element wspólny.</p>{variants.map((variant) => <label key={variant.id}><input type="checkbox" aria-label={`Przypisz do wariantu ${variant.name}`} checked={selected.variantIds?.includes(variant.id) ?? false} onChange={(event) => patchElement({ variantIds: event.target.checked ? [...(selected.variantIds ?? []), variant.id] : (selected.variantIds ?? []).filter((id) => id !== variant.id) })} />{variant.name}</label>)}</div></details>}
        </fieldset>}
        {selected && <details className="creator-fold" open><summary>Identyfikator</summary><label>ID obiektu<input value={selected.id} readOnly onFocus={(event) => event.currentTarget.select()} /></label></details>}
        </div>
      </aside>
    </div>
  </main>
}
