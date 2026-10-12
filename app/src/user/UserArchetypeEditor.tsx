import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, PDFDocumentLoadingTask } from 'pdfjs-dist'
import { templateUrl } from '../config'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function initialZoom() {
  if (window.innerWidth <= 520) return 0.5
  if (window.innerWidth <= 900) return 0.75
  return 1
}

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

export type ArchetypeConfig = {
  version: number
  templateFile: string
  archetypeName: string
  coordinateOrigin: 'top-left'
  fields: TemplateField[]
}

type Props = {
  archetypeFile: string
  clanName: string
  onClanNameChange: (value: string) => void
  characterName: string
  onCharacterNameChange: (value: string) => void
  onBack: () => void
  onExport: (config: ArchetypeConfig) => Promise<void>
}

export default function UserArchetypeEditor({
  archetypeFile,
  clanName,
  onClanNameChange,
  characterName,
  onCharacterNameChange,
  onBack,
  onExport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [config, setConfig] = useState<ArchetypeConfig | null>(null)
  const [zoom, setZoom] = useState(initialZoom)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [message, setMessage] = useState('Wczytywanie karty archetypu…')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const configFile = archetypeFile.replace(/\.pdf$/i, '.json')

    void fetch(templateUrl(`archetypy/${encodeURIComponent(configFile)}`))
      .then((response) => {
        if (!response.ok) throw new Error('Brak konfiguracji karty archetypu.')
        return response.json() as Promise<ArchetypeConfig>
      })
      .then((loadedConfig) => {
        setConfig(loadedConfig)
        setMessage('')
      })
      .catch((error: Error) => setMessage(error.message))
  }, [archetypeFile])

  useEffect(() => {
    if (!canvasRef.current) return

    let loadingTask: PDFDocumentLoadingTask | null = getDocument({
      url: templateUrl(`archetypy/${encodeURIComponent(archetypeFile)}`),
    })
    let cancelled = false

    void loadingTask.promise.then(async (document) => {
      const page = await document.getPage(1)
      const sourceViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

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
    }).catch(() => {
      if (!cancelled) setMessage('Nie udało się wyświetlić PDF-u.')
    })

    return () => {
      cancelled = true
      void loadingTask?.destroy()
      loadingTask = null
    }
  }, [archetypeFile, zoom])

  function changeZoom(direction: -1 | 1) {
    const index = ZOOM_LEVELS.indexOf(zoom)
    const nextIndex = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction))
    setZoom(ZOOM_LEVELS[nextIndex])
  }

  function valueForField(field: TemplateField) {
    return field.type === 'clanName' ? clanName : characterName
  }

  async function exportPdf() {
    if (!config || exporting) return

    setExporting(true)
    setMessage('Tworzenie PDF-u…')
    try {
      await onExport(config)
      setMessage('PDF został pobrany.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się utworzyć PDF-u.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="user-editor">
      <header className="user-header">
        <div>
          <a className="back-to-start" href="#">← Strona startowa</a>
          <h1>Karta archetypu</h1>
          <p>{config?.archetypeName || message}</p>
        </div>
        <div className="user-header-actions">
          <button className="back-to-clan-button" onClick={onBack}>Cofnij do edycji klanu</button>
          <button className="export-pdf-button" onClick={() => void exportPdf()} disabled={!config || exporting}>
            {exporting ? 'Tworzenie PDF-u…' : 'Eksportuj do PDF'}
          </button>
        </div>
      </header>

      <div className="user-layout">
        <aside className="character-form">
          <label className="archetype-text-input">
            Imię lub przydomek
            <input value={characterName} onChange={(event) => onCharacterNameChange(event.target.value)} />
          </label>
          <label className="archetype-text-input">
            Nazwa klanu
            <input value={clanName} onChange={(event) => onClanNameChange(event.target.value)} />
          </label>
        </aside>

        <section className="user-preview">
          <div className="preview-toolbar">
            <div className="user-zoom" aria-label="Powiększenie podglądu PDF">
              <button onClick={() => changeZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]}>−</button>
              <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                {ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level * 100}%</option>)}
              </select>
              <button onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS.at(-1)}>+</button>
            </div>
          </div>
          {message ? <div className="user-message">{message}</div> : null}
          <div
            className="user-pdf-page"
            style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}
          >
            <canvas ref={canvasRef} />
            {config?.fields.map((field) => (
              <div
                key={field.id}
                className="user-overlay user-text-overlay"
                style={{
                  left: field.x * zoom,
                  top: field.y * zoom,
                  width: field.width * zoom,
                  height: field.height * zoom,
                  fontSize: field.fontSize * zoom,
                }}
              >
                {valueForField(field)}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
