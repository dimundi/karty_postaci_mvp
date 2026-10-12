import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { templateUrl } from '../config'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5]

type FieldType = 'characterName' | 'clanName'

type TemplateField = {
  id: string
  type: FieldType
  label: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

type ArchetypeConfig = {
  version: number
  templateFile: string
  archetypeName: string
  coordinateOrigin: 'top-left'
  fields: TemplateField[]
}

type TemplateInfo = {
  fileName: string
  hasConfig: boolean
  archetypeName: string
}

type DragState = {
  fieldId: string
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export default function ArchetypeTemplateEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [config, setConfig] = useState<ArchetypeConfig | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.25)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [message, setMessage] = useState('Wczytywanie szablonów…')
  const [dirty, setDirty] = useState(false)

  const selectedField = useMemo(
    () => config?.fields.find((field) => field.id === selectedFieldId) ?? null,
    [config, selectedFieldId],
  )

  useEffect(() => {
    void fetch('/api/archetype-templates')
      .then((response) => response.json() as Promise<TemplateInfo[]>)
      .then((loadedTemplates) => {
        setTemplates(loadedTemplates)
        if (loadedTemplates[0]) {
          setSelectedFile(loadedTemplates[0].fileName)
        } else {
          setMessage('Brak plików PDF w pdfTemplates/archetypy.')
        }
      })
      .catch(() => setMessage('Nie udało się pobrać listy szablonów.'))
  }, [])

  useEffect(() => {
    if (!selectedFile) {
      return
    }

    setSelectedFieldId(null)
    setMessage('Wczytywanie konfiguracji…')

    void fetch(`/api/archetype-config?file=${encodeURIComponent(selectedFile)}`)
      .then((response) => response.json())
      .then(({ exists, config: loadedConfig }: { exists: boolean; config: ArchetypeConfig }) => {
        setConfig(loadedConfig)
        setDirty(false)
        setMessage(exists ? 'Wczytano istniejący JSON.' : 'Brak JSON-u. Utworzono pola domyślne.')
      })
      .catch(() => setMessage('Nie udało się wczytać konfiguracji.'))
  }, [selectedFile])

  useEffect(() => {
    if (!selectedFile || !canvasRef.current) {
      return
    }

    let loadingTask: PDFDocumentLoadingTask | null = getDocument({
      url: templateUrl(`archetypy/${encodeURIComponent(selectedFile)}`),
    })
    let cancelled = false

    void loadingTask.promise.then(async (document) => {
      const page = await document.getPage(1)
      const sourceViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current

      if (!canvas || cancelled) {
        return
      }

      const pixelRatio = window.devicePixelRatio || 1
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = Math.floor(viewport.width * pixelRatio)
      canvas.height = Math.floor(viewport.height * pixelRatio)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      setPageSize({ width: sourceViewport.width, height: sourceViewport.height })

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      }).promise
    }).catch(() => setMessage('Nie udało się wyświetlić PDF-u.'))

    return () => {
      cancelled = true
      void loadingTask?.destroy()
      loadingTask = null
    }
  }, [selectedFile, zoom])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const deltaX = (event.clientX - drag.startClientX) / zoom
      const deltaY = (event.clientY - drag.startClientY) / zoom
      updateField(drag.fieldId, drag.mode === 'move'
        ? { x: Math.max(0, round(drag.startX + deltaX)), y: Math.max(0, round(drag.startY + deltaY)) }
        : { width: Math.max(20, round(drag.startWidth + deltaX)), height: Math.max(8, round(drag.startHeight + deltaY)) })
    }
    const onPointerUp = () => { dragRef.current = null }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [zoom])

  function updateConfig(change: Partial<ArchetypeConfig>) {
    setConfig((current) => current ? { ...current, ...change } : current)
    setDirty(true)
  }

  function updateField(fieldId: string, change: Partial<TemplateField>) {
    setConfig((current) => current ? {
      ...current,
      fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...change } : field),
    } : current)
    setDirty(true)
  }

  function startDrag(event: ReactPointerEvent, field: TemplateField, mode: 'move' | 'resize') {
    event.preventDefault()
    event.stopPropagation()
    setSelectedFieldId(field.id)
    dragRef.current = {
      fieldId: field.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: field.x,
      startY: field.y,
      startWidth: field.width,
      startHeight: field.height,
    }
  }

  async function saveConfig() {
    if (!config || !selectedFile) return

    setMessage('Zapisywanie…')
    const response = await fetch(`/api/archetype-config?file=${encodeURIComponent(selectedFile)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const result = await response.json()

    if (!response.ok) {
      setMessage(result.error ?? 'Nie udało się zapisać konfiguracji.')
      return
    }

    setDirty(false)
    setTemplates((current) => current.map((template) =>
      template.fileName === selectedFile
        ? { ...template, hasConfig: true, archetypeName: config.archetypeName }
        : template,
    ))
    setMessage(`Zapisano ${selectedFile.replace(/\.pdf$/i, '.json')}.`)
  }

  function chooseTemplate(fileName: string) {
    if (dirty && !window.confirm('Masz niezapisane zmiany. Wczytać inną kartę?')) return
    setSelectedFile(fileName)
  }

  function changeZoom(direction: -1 | 1) {
    const index = ZOOM_LEVELS.indexOf(zoom)
    setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction))])
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <h1>Edytor kart archetypów</h1>
          <p>{message}</p>
        </div>
        <div className="header-actions">
          <a className="user-view-link" href="#dev">Tryb deweloperski</a>
          <a className="user-view-link" href="#user">Widok użytkownika</a>
          <div className="zoom-controls">
            <button onClick={() => changeZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]}>−</button>
            <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level * 100}%</option>)}
            </select>
            <button onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS.at(-1)}>+</button>
          </div>
          <button className="primary-button" disabled={!config || !dirty} onClick={() => void saveConfig()}>Zapisz JSON</button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel template-panel">
          <h2>Szablony archetypów</h2>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={template.fileName === selectedFile ? 'template-button active' : 'template-button'}
                key={template.fileName}
                onClick={() => chooseTemplate(template.fileName)}
              >
                <span>{template.archetypeName || template.fileName}</span>
                <small>{template.hasConfig ? 'JSON' : 'nowy'}</small>
              </button>
            ))}
          </div>
          <label>
            Nazwa archetypu
            <input value={config?.archetypeName ?? ''} onChange={(event) => updateConfig({ archetypeName: event.target.value })} />
          </label>
        </aside>

        <section className="pdf-workspace">
          <div className="pdf-page" style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }} onPointerDown={() => setSelectedFieldId(null)}>
            <canvas ref={canvasRef} />
            {config?.fields.map((field) => (
              <div
                key={field.id}
                className={`placed-field text-field ${field.id === selectedFieldId ? 'selected' : ''}`}
                style={{
                  left: field.x * zoom,
                  top: field.y * zoom,
                  width: field.width * zoom,
                  height: field.height * zoom,
                  fontSize: field.fontSize * zoom,
                }}
                onPointerDown={(event) => startDrag(event, field, 'move')}
              >
                {field.label}
                <span className="placed-field-label">{field.label}</span>
                <span className="resize-handle" onPointerDown={(event) => startDrag(event, field, 'resize')} />
              </div>
            ))}
          </div>
        </section>

        <aside className="editor-panel properties-panel">
          <h2>Pola</h2>
          <div className="field-list">
            {config?.fields.map((field) => (
              <button key={field.id} className={field.id === selectedFieldId ? 'field-button active' : 'field-button'} onClick={() => setSelectedFieldId(field.id)}>
                <span>{field.label}</span>
              </button>
            ))}
          </div>

          {selectedField ? (
            <div className="field-properties">
              <h2>Edycja pola</h2>
              <div className="number-grid">
                {(['x', 'y', 'width', 'height', 'fontSize'] as const).map((property) => (
                  <label key={property}>
                    {property}
                    <input type="number" step="0.1" value={selectedField[property]} onChange={(event) => updateField(selectedField.id, { [property]: Number(event.target.value) })} />
                  </label>
                ))}
              </div>
            </div>
          ) : <p>Wybierz pole na karcie lub z listy.</p>}
        </aside>
      </div>
    </main>
  )
}
