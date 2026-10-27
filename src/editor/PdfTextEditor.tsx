import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { exportPdf } from './exportPdf'
import { clamp } from './geometry'
import { isDirty, maxZ, patchBlock, reorder } from './model'
import { openPdf, pdfErrorMessage, readPdfInput } from './openPdf'
import { PdfPage } from './PdfPage'
import { createSamplePdf } from './samplePdf'
import { StylePanel } from './StylePanel'
import { Toolbar } from './Toolbar'
import type { EditorModel, ImageBlock, ImageKind, PdfRect, TextBlock, Tool } from './types'
import { useHistory } from './useHistory'
import './pdf-text-editor.css'

export type PdfSource = File | Blob | ArrayBuffer | Uint8Array | string | null

export type PdfTextEditorProps = {
  file?: PdfSource
  className?: string
}

export type PdfTextEditorHandle = {
  exportPdf: () => Promise<Uint8Array>
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Could not read that image.'))
    image.src = dataUrl
  })
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

function savePdf(bytes: Uint8Array, fileName: string) {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const PdfTextEditor = forwardRef<PdfTextEditorHandle, PdfTextEditorProps>(function PdfTextEditor(
  { file = null, className },
  ref,
) {
  const history = useHistory()
  const modelRef = useRef<EditorModel>(history.present)
  modelRef.current = history.present
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const originalRef = useRef<Uint8Array | null>(null)
  const loadId = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImage = useRef<{ pageIndex: number; x: number; y: number } | null>(null)
  const pageNodes = useRef(new Map<number, HTMLDivElement>())
  const panRef = useRef<{ pointer: number; x: number; y: number; left: number; top: number } | null>(null)

  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [fileLabel, setFileLabel] = useState('sample.pdf')
  const [tool, setTool] = useState<Tool>('edit-text')
  const [zoom, setZoom] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBytes = useCallback(
    async (bytes: Uint8Array, name: string) => {
      const id = ++loadId.current
      setLoading(true)
      setError(null)
      try {
        const opened = await openPdf(bytes)
        if (id !== loadId.current) {
          await opened.pdf.destroy()
          return
        }
        const previous = pdfRef.current
        pdfRef.current = opened.pdf
        if (previous && previous !== opened.pdf) await previous.destroy()
        originalRef.current = bytes.slice()
        const pageList: PDFPageProxy[] = []
        for (let index = 1; index <= opened.pdf.numPages; index += 1) {
          pageList.push(await opened.pdf.getPage(index))
        }
        if (id !== loadId.current) return
        setPages(pageList)
        history.reset({ blocks: opened.blocks, images: [] })
        setFileLabel(name)
        setSelectedId(null)
        setEditingId(null)
        setCurrentPage(0)
        setTool('edit-text')
      } catch (loadError) {
        if (id === loadId.current) setError(pdfErrorMessage(loadError))
      } finally {
        if (id === loadId.current) setLoading(false)
      }
    },
    [history.reset],
  )

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const bytes = file == null ? await createSamplePdf() : await readPdfInput(file)
        if (!active) return
        const name = file instanceof File ? file.name : 'sample.pdf'
        await loadBytes(bytes, name)
      } catch (loadError) {
        if (active) {
          setLoading(false)
          setError(pdfErrorMessage(loadError))
        }
      }
    })()
    return () => {
      active = false
    }
  }, [file, loadBytes])

  useEffect(() => {
    return () => {
      void pdfRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoom((value) => clamp(value * (event.deltaY > 0 ? 0.92 : 1.08), 0.4, 3))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const root = stageRef.current
    if (!root || pages.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const index = visible?.target.getAttribute('data-page')
        if (index != null) setCurrentPage(Number(index))
      },
      { root, threshold: [0.35, 0.6] },
    )
    for (const element of pageNodes.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [pages, zoom])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('.pte-editor'))) return
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) history.redo()
        else history.undo()
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        const id = selectedId
        history.commit((model) => ({
          blocks: model.blocks.map((block) => (block.id === id ? { ...block, removed: true } : block)),
          images: model.images.filter((image) => image.id !== id),
        }))
        setSelectedId(null)
        setEditingId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history.commit, history.redo, history.undo, selectedId])

  useImperativeHandle(ref, () => ({
    exportPdf: async () => {
      if (!originalRef.current) throw new Error('No PDF is open.')
      return exportPdf(originalRef.current, modelRef.current)
    },
  }))

  const selected = history.present.blocks.find((block) => block.id === selectedId && !block.removed) ?? null
  const imageSelected = history.present.images.some((image) => image.id === selectedId)
  const edited = history.present.blocks.some(isDirty) || history.present.images.length > 0

  const commitText = (id: string, text: string) => {
    setEditingId(null)
    const current = history.present.blocks.find((block) => block.id === id)
    if (!current || current.text === text) return
    history.commit((model) => patchBlock(model, id, { text }))
  }

  const commitRect = (id: string, rect: PdfRect) => {
    history.commit((model) => ({
      blocks: model.blocks.map((block) => (block.id === id ? { ...block, ...rect } : block)),
      images: model.images.map((image) => (image.id === id ? { ...image, ...rect } : image)),
    }))
  }

  const addParagraph = (pageIndex: number, x: number, y: number) => {
    const id = `text-${crypto.randomUUID()}`
    history.commit((model) => {
      const block: TextBlock = {
        id,
        pageIndex,
        x: x - 4,
        y: y - 36,
        width: 260,
        height: 42,
        text: 'New paragraph',
        fontSize: 14,
        fontFamily: 'helvetica',
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        align: 'left',
        color: '#1c2430',
        z: maxZ(model) + 1,
        removed: false,
        original: null,
      }
      return { ...model, blocks: [...model.blocks, block] }
    })
    setSelectedId(id)
    setEditingId(id)
    setTool('edit-text')
  }

  const addImage = (pageIndex: number, x: number, y: number) => {
    pendingImage.current = { pageIndex, x, y }
    imageInputRef.current?.click()
  }

  const onImageChosen = async (fileList: FileList | null) => {
    const chosen = fileList?.[0]
    const point = pendingImage.current
    pendingImage.current = null
    if (!chosen || !point) return
    const kind: ImageKind | null = chosen.type === 'image/png' ? 'png' : chosen.type === 'image/jpeg' ? 'jpg' : null
    if (!kind) {
      setError('Use a PNG or JPEG image.')
      return
    }
    try {
      const bytes = new Uint8Array(await chosen.arrayBuffer())
      const dataUrl = await readDataUrl(chosen)
      const size = await imageSize(dataUrl)
      const width = 180
      const height = Math.max(24, width * (size.height / Math.max(1, size.width)))
      const id = `image-${crypto.randomUUID()}`
      history.commit((model) => {
        const image: ImageBlock = {
          id,
          pageIndex: point.pageIndex,
          x: point.x,
          y: point.y - height,
          width,
          height,
          dataUrl,
          bytes,
          kind,
          z: maxZ(model) + 1,
        }
        return { ...model, images: [...model.images, image] }
      })
      setSelectedId(id)
      setTool('edit-text')
      setError(null)
    } catch (imageError) {
      setError(pdfErrorMessage(imageError))
    }
  }

  const download = async () => {
    if (!originalRef.current) return
    try {
      const bytes = await exportPdf(originalRef.current, history.present)
      const base = fileLabel.replace(/\.pdf$/i, '')
      savePdf(bytes, `${base}-edited.pdf`)
      setError(null)
    } catch (exportError) {
      setError(pdfErrorMessage(exportError))
    }
  }

  const goToPage = (index: number) => {
    const next = clamp(index, 0, Math.max(0, pages.length - 1))
    pageNodes.current.get(next)?.scrollIntoView({ block: 'start' })
    setCurrentPage(next)
  }

  return (
    <div className={`pte${className ? ` ${className}` : ''}${tool === 'pan' ? ' is-pan' : ''}`}>
      <Toolbar
        fileLabel={fileLabel}
        tool={tool}
        zoom={zoom}
        onTool={setTool}
        onZoom={(value) => setZoom(clamp(value, 0.4, 3))}
        onOpen={() => fileInputRef.current?.click()}
        onDownload={() => void download()}
        onReset={() => {
          if (originalRef.current) void loadBytes(originalRef.current.slice(), fileLabel)
        }}
      />
      <div className="pte-body">
        <div
          className="pte-stage"
          ref={stageRef}
          onPointerDown={(event) => {
            if (tool !== 'pan' || !stageRef.current) return
            panRef.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              left: stageRef.current.scrollLeft,
              top: stageRef.current.scrollTop,
            }
            stageRef.current.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const pan = panRef.current
            const stage = stageRef.current
            if (!pan || !stage || pan.pointer !== event.pointerId) return
            stage.scrollLeft = pan.left - (event.clientX - pan.x)
            stage.scrollTop = pan.top - (event.clientY - pan.y)
          }}
          onPointerUp={(event) => {
            if (panRef.current?.pointer === event.pointerId) panRef.current = null
          }}
        >
          {pages.map((page, index) => (
            <PdfPage
              key={`${fileLabel}-${index}`}
              page={page}
              pageIndex={index}
              zoom={zoom}
              tool={tool}
              blocks={history.present.blocks.filter((block) => block.pageIndex === index)}
              images={history.present.images.filter((image) => image.pageIndex === index)}
              selectedId={selectedId}
              editingId={editingId}
              onSelect={(id) => {
                setSelectedId(id)
                if (editingId && editingId !== id) setEditingId(null)
              }}
              onEdit={(id) => {
                setSelectedId(id)
                setEditingId(id)
                setTool('edit-text')
              }}
              onCommitText={commitText}
              onCommitRect={commitRect}
              onClear={() => {
                setSelectedId(null)
                setEditingId(null)
              }}
              onAddParagraph={addParagraph}
              onAddImage={addImage}
              register={(pageIndex, node) => {
                if (node) pageNodes.current.set(pageIndex, node)
                else pageNodes.current.delete(pageIndex)
              }}
            />
          ))}
          {loading ? <div className="pte-banner">Opening PDF…</div> : null}
        </div>
        <StylePanel
          selected={selected}
          imageSelected={imageSelected}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onChange={(patch) => {
            if (!selectedId) return
            history.commit((model) => patchBlock(model, selectedId, patch))
          }}
          onOrder={(mode) => {
            if (!selectedId) return
            history.commit((model) => reorder(model, selectedId, mode))
          }}
          onUndo={history.undo}
          onRedo={history.redo}
          onEdit={() => {
            if (selected) setEditingId(selected.id)
          }}
        />
      </div>
      <footer className="pte-footer">
        <button type="button" aria-label="Previous page" disabled={currentPage <= 0} onClick={() => goToPage(currentPage - 1)}>
          Prev
        </button>
        <label>
          Page
          <input
            aria-label="Page number"
            type="number"
            min={1}
            max={Math.max(1, pages.length)}
            value={pages.length === 0 ? 1 : currentPage + 1}
            onChange={(event) => goToPage(Number(event.target.value) - 1)}
          />
          <span>/ {Math.max(1, pages.length)}</span>
        </label>
        <button type="button" aria-label="Next page" disabled={currentPage >= pages.length - 1} onClick={() => goToPage(currentPage + 1)}>
          Next
        </button>
        <span className="pte-status">{error ?? (edited ? 'Edits stay in the boxes until you download.' : 'Click a dashed box, then double-click to edit the text.')}</span>
      </footer>
      <input
        ref={fileInputRef}
        className="pte-sr"
        type="file"
        accept="application/pdf"
        aria-label="Open a PDF"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          event.target.value = ''
          if (!chosen) return
          void readPdfInput(chosen).then((bytes) => loadBytes(bytes, chosen.name)).catch((loadError) => setError(pdfErrorMessage(loadError)))
        }}
      />
      <input
        ref={imageInputRef}
        className="pte-sr"
        type="file"
        accept="image/png,image/jpeg"
        aria-label="Choose an image"
        onChange={(event) => {
          const list = event.target.files
          event.target.value = ''
          void onImageChosen(list)
        }}
      />
    </div>
  )
})
