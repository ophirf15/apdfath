import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { LINE_HEIGHT, wrapText } from './geometry'
import { isDirty } from './model'
import type { EditorModel, ImageBlock, TextBlock } from './types'

type FontSet = {
  helvetica: PDFFont
  helveticaBold: PDFFont
  helveticaOblique: PDFFont
  helveticaBoldOblique: PDFFont
  times: PDFFont
  timesBold: PDFFont
  timesItalic: PDFFont
  timesBoldItalic: PDFFont
  courier: PDFFont
  courierBold: PDFFont
  courierOblique: PDFFont
  courierBoldOblique: PDFFont
}

function pickFont(block: TextBlock, fonts: FontSet): PDFFont {
  switch (block.fontFamily) {
    case 'helvetica':
      if (block.bold && block.italic) return fonts.helveticaBoldOblique
      if (block.bold) return fonts.helveticaBold
      if (block.italic) return fonts.helveticaOblique
      return fonts.helvetica
    case 'times':
      if (block.bold && block.italic) return fonts.timesBoldItalic
      if (block.bold) return fonts.timesBold
      if (block.italic) return fonts.timesItalic
      return fonts.times
    case 'courier':
      if (block.bold && block.italic) return fonts.courierBoldOblique
      if (block.bold) return fonts.courierBold
      if (block.italic) return fonts.courierOblique
      return fonts.courier
    default: {
      const neverFamily: never = block.fontFamily
      return neverFamily
    }
  }
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const value = match?.[1] ?? '1c2430'
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
  }
}

function winAnsi(text: string): string {
  return text.replace(/[^\n\r\t\u0020-\u007E\u00A0-\u00FF]/g, '')
}

function paintText(page: PDFPage, block: TextBlock, font: PDFFont) {
  const color = parseColor(block.color)
  const ink = rgb(color.r, color.g, color.b)
  const lines = wrapText(winAnsi(block.text), Math.max(8, block.width), (line) => font.widthOfTextAtSize(line || ' ', block.fontSize))
  const leading = block.fontSize * LINE_HEIGHT
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line || ' ', block.fontSize)
    let x = block.x
    if (block.align === 'center') x = block.x + Math.max(0, (block.width - lineWidth) / 2)
    if (block.align === 'right') x = block.x + Math.max(0, block.width - lineWidth)
    const baseline = block.y + block.height - block.fontSize * 0.85 - index * leading
    if (line) {
      page.drawText(line, { x, y: baseline, size: block.fontSize, font, color: ink })
    }
    if (block.underline) {
      page.drawLine({
        start: { x, y: baseline - 1.5 },
        end: { x: x + lineWidth, y: baseline - 1.5 },
        thickness: Math.max(0.6, block.fontSize / 16),
        color: ink,
      })
    }
    if (block.strike) {
      const mid = baseline + block.fontSize * 0.28
      page.drawLine({
        start: { x, y: mid },
        end: { x: x + lineWidth, y: mid },
        thickness: Math.max(0.6, block.fontSize / 16),
        color: ink,
      })
    }
  })
}

function cover(page: PDFPage, rect: { x: number; y: number; width: number; height: number }) {
  page.drawRectangle({
    x: rect.x - 1,
    y: rect.y - 1,
    width: rect.width + 2,
    height: rect.height + 2,
    color: rgb(1, 1, 1),
  })
}

async function paintImage(page: PDFPage, pdf: PDFDocument, image: ImageBlock) {
  const embedded = image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
  page.drawImage(embedded, {
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
  })
}

export async function exportPdf(original: Uint8Array, model: EditorModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original)
  const fonts: FontSet = {
    helvetica: await pdf.embedFont(StandardFonts.Helvetica),
    helveticaBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    helveticaOblique: await pdf.embedFont(StandardFonts.HelveticaOblique),
    helveticaBoldOblique: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    times: await pdf.embedFont(StandardFonts.TimesRoman),
    timesBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    timesItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    timesBoldItalic: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    courier: await pdf.embedFont(StandardFonts.Courier),
    courierBold: await pdf.embedFont(StandardFonts.CourierBold),
    courierOblique: await pdf.embedFont(StandardFonts.CourierOblique),
    courierBoldOblique: await pdf.embedFont(StandardFonts.CourierBoldOblique),
  }

  const pages = pdf.getPages()
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const blocks = model.blocks.filter((block) => block.pageIndex === pageIndex && isDirty(block))
    for (const block of blocks) {
      const source = block.original
      if (source) cover(page, source)
      if (!block.removed) paintText(page, block, pickFont(block, fonts))
    }
    const images = model.images
      .filter((image) => image.pageIndex === pageIndex)
      .sort((a, b) => a.z - b.z)
    for (const image of images) {
      await paintImage(page, pdf, image)
    }
  }

  return pdf.save()
}
