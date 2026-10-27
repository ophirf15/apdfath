import { useEffect, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import { applyResize, cssFamily, LINE_HEIGHT } from './geometry'
import { isDirty } from './model'
import type { ImageBlock, PdfRect, ResizeHandle, TextBlock, Tool } from './types'

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type LiveRect = { id: string; rect: PdfRect }

type DragState = {
  kind: 'move' | 'resize'
  id: string
  pointer: number
  handle: ResizeHandle | null
  startX: number
  startY: number
  rect: PdfRect
}

type PdfPageProps = {
  page: PDFPageProxy
  pageIndex: number
  zoom: number
  tool: Tool
  blocks: TextBlock[]
  images: ImageBlock[]
  selectedId: string | null
  editingId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onCommitText: (id: string, text: string) => void
  onCommitRect: (id: string, rect: PdfRect) => void
  onClear: () => void
  onAddParagraph: (pageIndex: number, x: number, y: number) => void
  onAddImage: (pageIndex: number, x: number, y: number) => void
  register: (pageIndex: number, node: HTMLDivElement | null) => void
}

function decoration(block: TextBlock): string {
  const parts = [block.underline ? 'underline' : '', block.strike ? 'line-through' : ''].filter(Boolean)
  return parts.join(' ')
}

function InlineEditor({ text, onCommit }: { text: string; onCommit: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.innerText = text
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [text])

  return (
    <div
      ref={ref}
      className="pte-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Edit PDF text"
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) => onCommit(event.currentTarget.innerText.replace(/\u00a0/g, ' '))}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') event.currentTarget.blur()
      }}
    />
  )
}

export function PdfPage({
  page,
  pageIndex,
  zoom,
  tool,
  blocks,
  images,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onCommitText,
  onCommitRect,
  onClear,
  onAddParagraph,
  onAddImage,
  register,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const liveRef = useRef<LiveRect | null>(null)
  const [live, setLive] = useState<LiveRect | null>(null)
  const viewport = page.getViewport({ scale: zoom })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const view = page.getViewport({ scale: zoom })
    canvas.width = Math.floor(view.width)
    canvas.height = Math.floor(view.height)
    let cancelled = false
    const task = page.render({ canvasContext: context, viewport: view })
    task.promise.catch((error: unknown) => {
      if (cancelled) return
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
      if (name === 'RenderingCancelledException') return
    })
    return () => {
      cancelled = true
      task.cancel()
    }
  }, [page, zoom])

  const remember = (next: LiveRect | null) => {
    liveRef.current = next
    setLive(next)
  }

  const rectFor = (id: string, fallback: PdfRect): PdfRect => (live?.id === id ? live.rect : fallback)

  const startDrag = (event: React.PointerEvent, id: string, rect: PdfRect, handle: ResizeHandle | null) => {
    if (tool === 'pan' || event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(id)
    dragRef.current = {
      kind: handle ? 'resize' : 'move',
      id,
      pointer: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect,
    }
  }

  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointer !== event.pointerId) return
    const dx = (event.clientX - drag.startX) / zoom
    const dy = -(event.clientY - drag.startY) / zoom
    if (drag.kind === 'move' && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return
    const rect =
      drag.kind === 'resize' && drag.handle
        ? applyResize(drag.rect, drag.handle, dx, dy)
        : { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }
    remember({ id: drag.id, rect })
  }

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointer !== event.pointerId) return
    dragRef.current = null
    const next = liveRef.current
    remember(null)
    if (!next || next.id !== drag.id) return
    const moved =
      Math.abs(next.rect.x - drag.rect.x) > 0.4 ||
      Math.abs(next.rect.y - drag.rect.y) > 0.4 ||
      Math.abs(next.rect.width - drag.rect.width) > 0.4 ||
      Math.abs(next.rect.height - drag.rect.height) > 0.4
    if (moved) onCommitRect(next.id, next.rect)
  }

  const placeAt = (event: React.PointerEvent) => {
    const node = pageRef.current
    if (!node) return
    const bounds = node.getBoundingClientRect()
    const [x, y] = viewport.convertToPdfPoint(event.clientX - bounds.left, event.clientY - bounds.top)
    if (tool === 'add-paragraph') onAddParagraph(pageIndex, x, y)
    if (tool === 'add-image') onAddImage(pageIndex, x, y)
    if (tool === 'edit-text' || tool === 'select') onClear()
  }

  return (
    <div
      className="pte-page"
      data-page={pageIndex}
      ref={(node) => {
        pageRef.current = node
        register(pageIndex, node)
      }}
      style={{ width: viewport.width, height: viewport.height }}
    >
      <canvas ref={canvasRef} />
      <div
        className={`pte-overlay${tool === 'add-paragraph' || tool === 'add-image' ? ' is-cross' : ''}`}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (tool === 'pan') return
          event.stopPropagation()
          placeAt(event)
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        {blocks
          .filter((block) => isDirty(block) && block.original)
          .map((block) => {
            const source = block.original
            if (!source) return null
            const mask = viewport.convertToViewportRectangle([source.x, source.y, source.x + source.width, source.y + source.height])
            const left = Math.min(mask[0], mask[2])
            const top = Math.min(mask[1], mask[3])
            return (
              <div
                key={`${block.id}-mask`}
                className="pte-mask"
                style={{ left, top, width: Math.abs(mask[2] - mask[0]), height: Math.abs(mask[3] - mask[1]) }}
              />
            )
          })}
        {images.map((image) => {
          const rect = rectFor(image.id, image)
          const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y + rect.height)
          const [x2, y2] = viewport.convertToViewportPoint(rect.x + rect.width, rect.y)
          const selected = selectedId === image.id
          return (
            <div
              key={image.id}
              className={`pte-box is-image${selected ? ' is-selected' : ''}`}
              style={{ left: x1, top: y1, width: x2 - x1, height: y2 - y1, zIndex: image.z + 2 }}
              onPointerDown={(event) => startDrag(event, image.id, rect, null)}
            >
              <img src={image.dataUrl} alt="" draggable={false} />
              {selected
                ? HANDLES.map((handle) => (
                    <span
                      key={handle}
                      className={`pte-handle ${handle}`}
                      onPointerDown={(event) => startDrag(event, image.id, rect, handle)}
                    />
                  ))
                : null}
            </div>
          )
        })}
        {blocks
          .filter((block) => !block.removed)
          .map((block) => {
            const rect = rectFor(block.id, block)
            const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y + rect.height)
            const [x2, y2] = viewport.convertToViewportPoint(rect.x + rect.width, rect.y)
            const selected = selectedId === block.id
            const editing = editingId === block.id
            const dirty = isDirty(block)
            return (
              <div
                key={block.id}
                className={`pte-box${selected ? ' is-selected' : ''}${dirty ? ' is-dirty' : ''}`}
                style={{
                  left: x1,
                  top: y1,
                  width: x2 - x1,
                  height: y2 - y1,
                  zIndex: block.z + 2,
                  color: block.color,
                  fontFamily: cssFamily(block.fontFamily),
                  fontSize: block.fontSize * zoom,
                  fontWeight: block.bold ? 700 : 400,
                  fontStyle: block.italic ? 'italic' : 'normal',
                  textDecoration: decoration(block),
                  textAlign: block.align,
                  lineHeight: LINE_HEIGHT,
                }}
                onPointerDown={(event) => {
                  if (editing) return
                  startDrag(event, block.id, rect, null)
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  onEdit(block.id)
                }}
              >
                {editing ? <InlineEditor text={block.text} onCommit={(text) => onCommitText(block.id, text)} /> : null}
                {!editing && dirty ? <div className="pte-text">{block.text}</div> : null}
                {selected && !editing
                  ? HANDLES.map((handle) => (
                      <span
                        key={handle}
                        className={`pte-handle ${handle}`}
                        onPointerDown={(event) => startDrag(event, block.id, rect, handle)}
                      />
                    ))
                  : null}
              </div>
            )
          })}
      </div>
    </div>
  )
}
