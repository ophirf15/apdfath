import { readPdfInput } from './openPdf'

function isDocxName(name: string): boolean {
  return /\.docx$/i.test(name)
}

function isDocxFile(file: File): boolean {
  if (isDocxName(file.name)) return true
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword'
  )
}

/** Open a PDF as-is, or convert DOCX → PDF through the Vite `/api/convert` middleware. */
export async function openDocumentFile(file: File): Promise<{ bytes: Uint8Array; label: string }> {
  if (!isDocxFile(file)) {
    return { bytes: await readPdfInput(file), label: file.name }
  }

  const response = await fetch('/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) {
    let detail = `DOCX conversion failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) detail = payload.error
    } catch {
      /* keep status message */
    }
    throw new Error(detail)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const label = file.name.replace(/\.docx$/i, '.pdf')
  return { bytes, label }
}
