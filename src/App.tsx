import { useRef, useState } from 'react'
import { PdfTextEditor, type PdfTextEditorHandle } from './editor/PdfTextEditor'

export function App() {
  const editorRef = useRef<PdfTextEditorHandle>(null)
  const [dirty, setDirty] = useState(false)
  const [lastExport, setLastExport] = useState<string | null>(null)

  return (
    <div className="lab-shell">
      <header className="lab-bar">
        <div>
          <p className="lab-brand">apdfath</p>
          <p className="lab-sub">Apryse content-edit workflow — open → select → edit → download</p>
        </div>
        <div className="lab-actions">
          <span className={`lab-pill${dirty ? ' is-dirty' : ''}`}>{dirty ? 'Unsaved edits' : 'Clean'}</span>
          <button
            type="button"
            className="pte-text-button pte-primary"
            onClick={() => void editorRef.current?.exportPdf().then((bytes) => {
              const name = `${(editorRef.current?.getFileLabel() ?? 'document').replace(/\.pdf$/i, '')}-edited.pdf`
              const copy = new Uint8Array(bytes)
              const blob = new Blob([copy], { type: 'application/pdf' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = name
              link.click()
              URL.revokeObjectURL(url)
              setLastExport(`${name} · ${(bytes.byteLength / 1024).toFixed(1)} KB`)
            })}
          >
            Save PDF
          </button>
        </div>
      </header>
      {lastExport ? <p className="lab-note">Last export: {lastExport}</p> : null}
      <PdfTextEditor
        ref={editorRef}
        onDirtyChange={setDirty}
        onExported={(bytes, fileName) => {
          setLastExport(`${fileName} · ${(bytes.byteLength / 1024).toFixed(1)} KB`)
        }}
      />
    </div>
  )
}
