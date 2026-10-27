import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { clusterText } from './extract'
import type { TextBlock } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

export async function readPdfInput(file: File | Blob | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  if (typeof file === 'string') {
    const response = await fetch(file)
    if (!response.ok) throw new Error(`Could not fetch PDF (${response.status})`)
    return new Uint8Array(await response.arrayBuffer())
  }
  if (file instanceof Uint8Array) return file.slice()
  if (file instanceof ArrayBuffer) return new Uint8Array(file.slice(0))
  return new Uint8Array(await file.arrayBuffer())
}

export async function openPdf(bytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; blocks: TextBlock[] }> {
  const pdf = await getDocument({ data: bytes.slice() }).promise
  const blocks: TextBlock[] = []
  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1)
    const content = await page.getTextContent()
    blocks.push(...clusterText(content, pageIndex))
  }
  return { pdf, blocks }
}

export function pdfErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'PasswordException') {
    return 'This PDF is password protected.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Could not open this PDF.'
}
