import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { wrapText } from './geometry'

const NAVY = rgb(0.09, 0.16, 0.28)
const INK = rgb(0.12, 0.14, 0.18)

async function drawParagraph(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  x: number,
  yTop: number,
  size: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>,
): Promise<number> {
  const lines = wrapText(text, maxWidth, (line) => font.widthOfTextAtSize(line, size))
  const leading = size * 1.35
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: yTop - size - index * leading,
      size,
      font,
      color,
    })
  })
  return yTop - lines.length * leading - size * 0.9
}

export async function createSamplePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  const second = pdf.addPage([612, 792])

  let y = 730
  y = await drawParagraph(
    page,
    bold,
    'PDF text editing',
    72,
    y,
    26,
    460,
    NAVY,
  )
  y = await drawParagraph(
    page,
    regular,
    'Double-click a paragraph to edit the words. Drag the box to move it, or drag a handle to resize it.',
    72,
    y,
    13,
    460,
    INK,
  )
  y = await drawParagraph(
    page,
    regular,
    'Font, size, color, bold, italic, underline, and alignment apply to the selected box. Add Paragraph places new text. New Image places a picture.',
    72,
    y,
    13,
    460,
    INK,
  )
  await drawParagraph(
    page,
    regular,
    'Download as PDF writes the edited boxes back into the file. Text you did not change stays in the original PDF.',
    72,
    y,
    13,
    460,
    INK,
  )

  await drawParagraph(
    second,
    bold,
    'Second page',
    72,
    730,
    22,
    460,
    NAVY,
  )
  await drawParagraph(
    second,
    regular,
    'Each page keeps its own text boxes. Move between pages with the controls at the bottom of the editor.',
    72,
    680,
    13,
    460,
    INK,
  )

  return pdf.save()
}
