import { PDFDocument, PDFName, drawSvgPath, popGraphicsState, pushGraphicsState, rgb, scale } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import formFontUrl from '../assets/fonts/NotoSans-Regular.ttf'
import checkedV from '../assets/checked_v.svg'
import checkedX from '../assets/checked_x.svg'
import { templateUrl } from '../config'

type ClanFieldType = 'factionAspect' | 'heat' | 'talent' | 'darkInstinct' | 'darkGift'

type ClanField = {
  id: string
  type: ClanFieldType
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  order?: number
  markStyle?: 'x' | 'v'
}

type ArchetypeField = {
  id: string
  type: 'characterName' | 'clanName'
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

type ExportOptions = {
  clan: {
    templateFile: string
    fields: ClanField[]
    checkedFields: Record<string, boolean>
    counters: Record<'heat' | 'darkInstinct', number>
    texts: Record<string, string>
  }
  archetype: {
    templateFile: string
    fields: ArchetypeField[]
    characterName: string
    clanName: string
  }
}

const RENDER_SCALE = 2

export async function exportCharacterPdf({ clan, archetype }: ExportOptions) {
  const output = await PDFDocument.create()
  const markers = {
    x: await loadImage(checkedX),
    v: await loadImage(checkedV),
  }
  const interactiveMarkers = {
    x: await loadMarkerPath(checkedX),
    v: await loadMarkerPath(checkedV),
  }

  const clanPage = await addTemplatePage(output, templateUrl(`klany/${encodeURIComponent(clan.templateFile)}`), (context) => {
    for (const field of clan.fields) {
      if (field.type === 'talent' || field.type === 'factionAspect') continue
      if (field.type === 'darkGift') {
        drawWrappedText(context, clan.texts[field.id] ?? '', field)
        continue
      }

      const checked = field.type === 'heat' || field.type === 'darkInstinct'
        ? (field.order ?? 1) <= clan.counters[field.type]
        : Boolean(clan.checkedFields[field.id])

      if (checked) drawCheck(context, field, markers[field.markStyle ?? 'x'])
    }
  })

  const form = output.getForm()
  for (const field of clan.fields) {
    if (field.type !== 'talent' && field.type !== 'factionAspect') continue

    const checkbox = form.createCheckBox(`${field.type}.${field.id}`)
    checkbox.addToPage(clanPage, {
      x: field.x,
      y: clanPage.getHeight() - field.y - field.height,
      width: field.width,
      height: field.height,
      borderWidth: 0,
      backgroundColor: undefined,
      borderColor: undefined,
    })
    if (clan.checkedFields[field.id]) checkbox.check()
    else checkbox.uncheck()

    // Znak jest częścią stanu „on” formularza. Stan „off” pozostawia szablon widoczny.
    checkbox.updateAppearances(() => ({
      normal: {
        on: [
          pushGraphicsState(),
          scale(field.width / 100, field.height / 100),
          ...drawSvgPath(interactiveMarkers[field.markStyle ?? (field.type === 'talent' ? 'v' : 'x')], {
            x: 0, y: 100, scale: 1,
            color: rgb(35 / 255, 31 / 255, 32 / 255),
            borderColor: undefined, borderWidth: 0,
          }),
          popGraphicsState(),
        ],
        off: [],
      },
    }))
  }

  const archetypePage = await addTemplatePage(output, templateUrl(`archetypy/${encodeURIComponent(archetype.templateFile)}`))
  if (archetype.fields.length) {
    const response = await fetch(formFontUrl)
    if (!response.ok) throw new Error('Nie udało się wczytać czcionki formularza PDF.')
    output.registerFontkit(fontkit)
    // Pełny font zawiera także znaki potrzebne przy późniejszej edycji w czytniku PDF.
    const font = await output.embedFont(await response.arrayBuffer(), { subset: false })
    // Czytnik używa zasobów formularza do wyświetlania tekstu wpisanego po eksporcie.
    form.acroForm.dict.set(PDFName.of('DR'), output.context.obj({
      Font: { [font.name]: font.ref },
    }))
    for (const field of archetype.fields) {
      const textField = form.createTextField(`archetype.${field.id}`)
      textField.setText(field.type === 'clanName' ? archetype.clanName : archetype.characterName)
      textField.addToPage(archetypePage, {
        x: field.x,
        y: archetypePage.getHeight() - field.y - field.height,
        width: field.width,
        height: field.height,
        borderWidth: 0,
        backgroundColor: undefined,
        borderColor: undefined,
        textColor: rgb(17 / 255, 17 / 255, 17 / 255),
        font,
      })
      textField.setFontSize(field.fontSize)
      textField.updateAppearances(font)
    }
  }

  const bytes = await output.save()
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = (archetype.characterName.trim() || 'postać').replace(/[\\/:*?"<>|]+/g, '-')

  link.href = url
  link.download = `Klanarchia - ${safeName}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function addTemplatePage(
  output: PDFDocument,
  sourceUrl: string,
  drawOverlay?: (context: CanvasRenderingContext2D) => void,
) {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error('Nie udało się pobrać szablonu PDF.')

  const source = await PDFDocument.load(await response.arrayBuffer())
  const [page] = await output.copyPages(source, [0])
  output.addPage(page)
  if (!drawOverlay) return page

  const { width, height } = page.getSize()
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * RENDER_SCALE)
  canvas.height = Math.ceil(height * RENDER_SCALE)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nie udało się utworzyć warstwy PDF.')

  context.scale(RENDER_SCALE, RENDER_SCALE)
  context.fillStyle = '#111'
  drawOverlay(context)

  const overlayBytes = await canvasToPng(canvas)
  const overlay = await output.embedPng(overlayBytes)
  page.drawImage(overlay, { x: 0, y: 0, width, height })
  return page
}

async function loadMarkerPath(source: string) {
  const response = await fetch(source)
  if (!response.ok) throw new Error('Nie udało się wczytać grafiki zaznaczenia.')
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml')
  const path = svg.querySelector('path')?.getAttribute('d')
  if (!path) throw new Error('Brak ścieżki w grafice zaznaczenia.')
  return path
}

function drawCheck(context: CanvasRenderingContext2D, field: ClanField, marker: HTMLImageElement) {
  context.save()
  context.drawImage(marker, field.x, field.y, field.width, field.height)
  context.restore()
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nie udało się wczytać grafiki zaznaczenia.'))
    image.src = source
  })
}

function drawWrappedText(context: CanvasRenderingContext2D, value: string, field: ClanField) {
  const fontSize = field.fontSize ?? 10
  const lineHeight = fontSize * 1.2
  const maximumWidth = Math.max(1, field.width - 4)
  const maximumY = field.y + field.height
  let y = field.y + 2

  context.save()
  context.beginPath()
  context.rect(field.x, field.y, field.width, field.height)
  context.clip()
  context.font = `${fontSize}px Arial, sans-serif`
  context.textBaseline = 'top'

  for (const paragraph of value.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && context.measureText(candidate).width > maximumWidth) {
        if (y + lineHeight > maximumY) break
        context.fillText(line, field.x + 2, y)
        y += lineHeight
        line = word
      } else {
        line = candidate
      }
    }

    if (line && y + lineHeight <= maximumY) {
      context.fillText(line, field.x + 2, y)
      y += lineHeight
    }
  }

  context.restore()
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Nie udało się utworzyć warstwy PDF.'))
        return
      }
      void blob.arrayBuffer().then(resolve, reject)
    }, 'image/png')
  })
}
