import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createRequire } from 'node:module'

// Lightweight smoke: whiteout + redraw round-trip without the React tree.
const pdf = await PDFDocument.create()
const page = pdf.addPage([400, 600])
const font = await pdf.embedFont(StandardFonts.Helvetica)
page.drawText('Lease rent is $1,200.', { x: 48, y: 520, size: 14, font, color: rgb(0.1, 0.1, 0.1) })
const original = await pdf.save()

const edited = await PDFDocument.load(original)
const outPage = edited.getPages()[0]
outPage.drawRectangle({ x: 46, y: 505, width: 220, height: 22, color: rgb(1, 1, 1) })
const outFont = await edited.embedFont(StandardFonts.Helvetica)
outPage.drawText('Lease rent is $1,450.', { x: 48, y: 520, size: 14, font: outFont, color: rgb(0.1, 0.1, 0.1) })
const bytes = await edited.save()

if (bytes.byteLength < 200) throw new Error('export too small')
console.log(`smoke-export ok · ${bytes.byteLength} bytes`)
