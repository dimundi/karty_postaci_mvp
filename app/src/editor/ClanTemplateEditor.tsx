import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, PDFDocumentLoadingTask } from 'pdfjs-dist'
import checkedV from '../assets/checked_v.svg'
import checkedX from '../assets/checked_x.svg'
import { templateUrl } from '../config'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5]
const CHECKBOX_SIZES = {
  small: 10,
  large: 14,
  extraLarge: 18,
} as const

type FieldType = 'factionAspect' | 'heat' | 'talent' | 'darkInstinct' | 'darkGift'
type MarkStyle = 'x' | 'v'

type TemplateField = {
  id: string
  type: FieldType
  label: string
  x: number
  y: number
  width: number
  height: number
  parentId?: string
  fontSize?: number
  order?: number
  markStyle?: MarkStyle
}

type ClanTemplateConfig = {
  version: number
  templateFile: string
  clanId: string
  logoFile: string
  clanName: string
  coordinateOrigin: 'top-left'
  fields: TemplateField[]
}

type TemplateInfo = {
  fileName: string
  hasConfig: boolean
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

const fieldTypeLabels: Record<FieldType, string> = {
  factionAspect: 'Aspekt frakcji',
  heat: 'Żar',
  talent: 'Talent',
  darkInstinct: 'Mroczny instynkt',
  darkGift: 'Dary ciemności',
}

const defaultFieldSize: Record<FieldType, { width: number; height: number }> = {
  factionAspect: { width: CHECKBOX_SIZES.small, height: CHECKBOX_SIZES.small },
  heat: { width: 14, height: 14 },
  talent: { width: 14, height: 14 },
  darkInstinct: { width: CHECKBOX_SIZES.extraLarge, height: CHECKBOX_SIZES.extraLarge },
  darkGift: { width: 180, height: 80 },
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function makeFieldId(type: FieldType) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isNumberedField(type: FieldType) {
  return type === 'heat' || type === 'darkInstinct'
}

function defaultMarkStyle(type: FieldType): MarkStyle {
  return type === 'talent' ? 'v' : 'x'
}

function withDefaultMarkStyles(fields: TemplateField[]) {
  return fields.map((field) => field.type === 'darkGift' ? field : {
    ...field,
    markStyle: field.markStyle ?? defaultMarkStyle(field.type),
  })
}

function markerSource(field: TemplateField) {
  return (field.markStyle ?? defaultMarkStyle(field.type)) === 'v' ? checkedV : checkedX
}

function renumberFields(fields: TemplateField[], type: FieldType) {
  let order = 0

  return fields.map((field) => {
    if (field.type !== type) {
      return field
    }

    order += 1
    return {
      ...field,
      order,
      label: `${fieldTypeLabels[type]} ${order}`,
    }
  })
}

export default function ClanTemplateEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [config, setConfig] = useState<ClanTemplateConfig | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [newFieldType, setNewFieldType] = useState<FieldType>('factionAspect')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1.25)
  const [message, setMessage] = useState('Wczytywanie szablonów…')
  const [dirty, setDirty] = useState(false)

  const selectedField = useMemo(
    () => config?.fields.find((field) => field.id === selectedFieldId) ?? null,
    [config, selectedFieldId],
  )

  const aspects = useMemo(
    () => config?.fields.filter((field) => field.type === 'factionAspect') ?? [],
    [config],
  )

  useEffect(() => {
    void fetch('/api/clan-templates')
      .then((response) => response.json() as Promise<TemplateInfo[]>)
      .then((loadedTemplates) => {
        setTemplates(loadedTemplates)

        if (loadedTemplates.length > 0) {
          setSelectedFile(loadedTemplates[0].fileName)
        } else {
          setMessage('Brak plików PDF w pdfTemplates/klany.')
        }
      })
      .catch(() => setMessage('Nie udało się pobrać listy szablonów.'))
  }, [])

  useEffect(() => {
    if (!selectedFile) {
      return
    }

    setMessage('Wczytywanie konfiguracji…')
    setSelectedFieldId(null)

    void fetch(`/api/clan-config?file=${encodeURIComponent(selectedFile)}`)
      .then((response) => response.json())
      .then(({ exists, config: loadedConfig }: { exists: boolean; config: ClanTemplateConfig }) => {
        setConfig({
          ...loadedConfig,
          fields: renumberFields(
            renumberFields(withDefaultMarkStyles(loadedConfig.fields), 'heat'),
            'darkInstinct',
          ),
        })
        setDirty(false)
        setMessage(exists ? 'Wczytano istniejący JSON.' : 'Brak JSON-u. Utworzono pustą konfigurację.')
      })
      .catch(() => setMessage('Nie udało się wczytać konfiguracji.'))
  }, [selectedFile])

  useEffect(() => {
    if (!selectedFile || !canvasRef.current) {
      return
    }

    let loadingTask: PDFDocumentLoadingTask | null = null
    let cancelled = false

    loadingTask = getDocument({ url: templateUrl(`klany/${encodeURIComponent(selectedFile)}`) })

    void loadingTask.promise
      .then(async (loadedDocument) => {
        const page = await loadedDocument.getPage(1)
        const pdfViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: zoom })
        const canvas = canvasRef.current

        if (!canvas || cancelled) {
          return
        }

        const pixelRatio = window.devicePixelRatio || 1
        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Brak kontekstu canvas.')
        }

        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        setPageSize({ width: pdfViewport.width, height: pdfViewport.height })

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise
      })
      .catch(() => setMessage('Nie udało się wyświetlić PDF-u.'))

    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [selectedFile, zoom])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current

      if (!drag) {
        return
      }

      const deltaX = (event.clientX - drag.startClientX) / zoom
      const deltaY = (event.clientY - drag.startClientY) / zoom

      updateField(drag.fieldId, drag.mode === 'move'
        ? {
            x: Math.max(0, round(drag.startX + deltaX)),
            y: Math.max(0, round(drag.startY + deltaY)),
          }
        : {
            width: Math.max(6, round(drag.startWidth + deltaX)),
            height: Math.max(6, round(drag.startHeight + deltaY)),
          })
    }

    const onPointerUp = () => {
      dragRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [zoom])

  function updateConfig(change: Partial<ClanTemplateConfig>) {
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

  function addField() {
    if (!config) {
      return
    }

    const existingFieldsOfType = config.fields.filter((field) => field.type === newFieldType)

    if (isNumberedField(newFieldType) && existingFieldsOfType.length >= 3) {
      setMessage(`Można dodać maksymalnie 3 pola: ${fieldTypeLabels[newFieldType]}.`)
      return
    }

    const size = defaultFieldSize[newFieldType]
    const order = isNumberedField(newFieldType) ? existingFieldsOfType.length + 1 : undefined
    const field: TemplateField = {
      id: makeFieldId(newFieldType),
      type: newFieldType,
      label: order ? `${fieldTypeLabels[newFieldType]} ${order}` : newFieldLabel.trim() || fieldTypeLabels[newFieldType],
      x: 20,
      y: 20,
      width: size.width,
      height: size.height,
      ...(order ? { order } : {}),
      ...(newFieldType === 'darkGift' ? { fontSize: 10 } : {}),
      ...(newFieldType !== 'darkGift' ? { markStyle: defaultMarkStyle(newFieldType) } : {}),
    }

    updateConfig({ fields: [...config.fields, field] })
    setSelectedFieldId(field.id)
    setNewFieldLabel('')
  }

  function deleteSelectedField() {
    if (!config || !selectedFieldId) {
      return
    }

    const deletedField = config.fields.find((field) => field.id === selectedFieldId)
    const remainingFields = config.fields.filter((field) => field.id !== selectedFieldId)

    updateConfig({
      fields: deletedField && isNumberedField(deletedField.type)
        ? renumberFields(remainingFields, deletedField.type)
        : remainingFields,
    })
    setSelectedFieldId(null)
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
    if (!config || !selectedFile) {
      return
    }

    setMessage('Zapisywanie…')
    const response = await fetch(`/api/clan-config?file=${encodeURIComponent(selectedFile)}`, {
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
      template.fileName === selectedFile ? { ...template, hasConfig: true } : template,
    ))
    setMessage(`Zapisano ${selectedFile.replace(/\.pdf$/i, '.json')}.`)
  }

  function chooseTemplate(fileName: string) {
    if (dirty && !window.confirm('Masz niezapisane zmiany. Wczytać inną kartę?')) {
      return
    }

    setSelectedFile(fileName)
  }

  function changeZoom(direction: -1 | 1) {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom)
    const nextIndex = Math.min(
      ZOOM_LEVELS.length - 1,
      Math.max(0, (currentIndex === -1 ? 2 : currentIndex) + direction),
    )
    setZoom(ZOOM_LEVELS[nextIndex])
  }

  function setCheckboxSize(fieldId: string, size: keyof typeof CHECKBOX_SIZES) {
    const value = CHECKBOX_SIZES[size]
    updateField(fieldId, { width: value, height: value })
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <h1>Edytor kart klanu</h1>
          <p>{message}</p>
        </div>
        <div className="header-actions">
          <a className="user-view-link" href="#dev">Tryb deweloperski</a>
          <a className="user-view-link" href="#user">Widok użytkownika</a>
          <div className="zoom-controls" aria-label="Powiększenie PDF">
            <button onClick={() => changeZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]}>−</button>
            <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {ZOOM_LEVELS.map((level) => (
                <option key={level} value={level}>{Math.round(level * 100)}%</option>
              ))}
            </select>
            <button onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS.at(-1)}>+</button>
          </div>
          <button className="primary-button" disabled={!config || !dirty} onClick={() => void saveConfig()}>
            Zapisz JSON
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel template-panel">
          <h2>Szablony</h2>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={template.fileName === selectedFile ? 'template-button active' : 'template-button'}
                key={template.fileName}
                onClick={() => chooseTemplate(template.fileName)}
              >
                <span>{template.fileName}</span>
                <small>{template.hasConfig ? 'JSON' : 'nowy'}</small>
              </button>
            ))}
          </div>

          <label>
            Nazwa klanu
            <input
              value={config?.clanName ?? ''}
              onChange={(event) => updateConfig({ clanName: event.target.value })}
            />
          </label>

          <label>
            Identyfikator klanu
            <input
              value={config?.clanId ?? ''}
              onChange={(event) => updateConfig({ clanId: event.target.value })}
              placeholder="np. rytualisci"
            />
          </label>

          <label>
            Plik logo
            <input
              value={config?.logoFile ?? ''}
              onChange={(event) => updateConfig({ logoFile: event.target.value })}
              placeholder="np. logo-rytualisci.svg"
            />
          </label>

          <h2>Dodaj pole</h2>
          <label>
            Typ
            <select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as FieldType)}>
              {Object.entries(fieldTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Nazwa
            <input
              value={isNumberedField(newFieldType) ? 'Nadawana automatycznie' : newFieldLabel}
              disabled={isNumberedField(newFieldType)}
              onChange={(event) => setNewFieldLabel(event.target.value)}
            />
          </label>
          <button onClick={addField} disabled={!config}>Dodaj</button>
        </aside>

        <section className="pdf-workspace">
          <div
            className="pdf-page"
            style={{
              width: pageSize.width * zoom,
              height: pageSize.height * zoom,
            }}
            onPointerDown={() => setSelectedFieldId(null)}
          >
            <canvas ref={canvasRef} />
            {config?.fields.map((field) => (
              <div
                key={field.id}
                className={`placed-field ${field.type === 'darkGift' ? 'text-field' : 'check-field'} ${field.id === selectedFieldId ? 'selected' : ''}`}
                style={{
                  left: field.x * zoom,
                  top: field.y * zoom,
                  width: field.width * zoom,
                  height: field.height * zoom,
                  fontSize: field.type === 'darkGift'
                    ? (field.fontSize ?? 10) * zoom
                    : Math.max(10, field.height * 0.9) * zoom,
                }}
                title={field.label}
                onPointerDown={(event) => startDrag(event, field, 'move')}
              >
                {field.type === 'darkGift' ? 'Przykładowy opis darów ciemności' : (
                  <img className="placed-marker" src={markerSource(field)} alt="" />
                )}
                <span className="placed-field-label">{field.label}</span>
                {field.type === 'darkGift' ? (
                  <span
                    className="resize-handle"
                    onPointerDown={(event) => startDrag(event, field, 'resize')}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="editor-panel properties-panel">
          <h2>Pola</h2>
          <div className="field-list">
            {config?.fields.map((field) => (
              <button
                key={field.id}
                className={field.id === selectedFieldId ? 'field-button active' : 'field-button'}
                onClick={() => setSelectedFieldId(field.id)}
              >
                <span>{field.label}</span>
                <small>{fieldTypeLabels[field.type]}</small>
              </button>
            ))}
          </div>

          {selectedField ? (
            <div className="field-properties">
              <h2>Edycja pola</h2>
              {isNumberedField(selectedField.type) ? (
                <p className="automatic-field-name">Numer: {selectedField.order}</p>
              ) : (
                <label>
                  Nazwa
                  <input value={selectedField.label} onChange={(event) => updateField(selectedField.id, { label: event.target.value })} />
                </label>
              )}
              <div className="number-grid">
                {(['x', 'y'] as const).map((property) => (
                  <label key={property}>
                    {property}
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField[property]}
                      onChange={(event) => updateField(selectedField.id, { [property]: Number(event.target.value) })}
                    />
                  </label>
                ))}
                {selectedField.type === 'darkGift' ? (['width', 'height'] as const).map((property) => (
                  <label key={property}>
                    {property}
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField[property]}
                      onChange={(event) => updateField(selectedField.id, { [property]: Number(event.target.value) })}
                    />
                  </label>
                )) : null}
              </div>

              {selectedField.type !== 'darkGift' ? (
                <div className="checkbox-size-controls">
                  <span>Rozmiar checkboxa</span>
                  <div>
                    <button
                      className={selectedField.width === CHECKBOX_SIZES.small && selectedField.height === CHECKBOX_SIZES.small ? 'active' : ''}
                      onClick={() => setCheckboxSize(selectedField.id, 'small')}
                    >
                      Mały
                    </button>
                    <button
                      className={selectedField.width === CHECKBOX_SIZES.large && selectedField.height === CHECKBOX_SIZES.large ? 'active' : ''}
                      onClick={() => setCheckboxSize(selectedField.id, 'large')}
                    >
                      Duży
                    </button>
                    <button
                      className={selectedField.width === CHECKBOX_SIZES.extraLarge && selectedField.height === CHECKBOX_SIZES.extraLarge ? 'active' : ''}
                      onClick={() => setCheckboxSize(selectedField.id, 'extraLarge')}
                    >
                      Bardzo duży
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedField.type !== 'darkGift' ? (
                <label>
                  Styl zaznaczenia
                  <select
                    value={selectedField.markStyle ?? defaultMarkStyle(selectedField.type)}
                    onChange={(event) => updateField(selectedField.id, { markStyle: event.target.value as MarkStyle })}
                  >
                    <option value="x">X</option>
                    <option value="v">V</option>
                  </select>
                </label>
              ) : null}

              {selectedField.type === 'heat' ? (
                <label>
                  Powiązany aspekt
                  <select
                    value={selectedField.parentId ?? ''}
                    onChange={(event) => updateField(selectedField.id, { parentId: event.target.value || undefined })}
                  >
                    <option value="">Brak</option>
                    {aspects.map((aspect) => <option key={aspect.id} value={aspect.id}>{aspect.label}</option>)}
                  </select>
                </label>
              ) : null}

              {selectedField.type === 'darkGift' ? (
                <label>
                  Rozmiar tekstu
                  <input
                    type="number"
                    min="4"
                    value={selectedField.fontSize ?? 10}
                    onChange={(event) => updateField(selectedField.id, { fontSize: Number(event.target.value) })}
                  />
                </label>
              ) : null}

              <button className="danger-button" onClick={deleteSelectedField}>Usuń pole</button>
            </div>
          ) : (
            <p>Wybierz pole na karcie lub z listy.</p>
          )}
        </aside>
      </div>
    </main>
  )
}
