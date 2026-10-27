import type { ReactNode } from 'react'
import type { Tool } from './types'

function zoomStops(zoom: number): number[] {
  const stops = [50, 75, 100, 125, 150, 200, 300]
  const current = Math.round(zoom * 100)
  if (stops.includes(current)) return stops
  return [...stops, current].sort((a, b) => a - b)
}

type ToolbarProps = {
  fileLabel: string
  tool: Tool
  zoom: number
  onTool: (tool: Tool) => void
  onZoom: (zoom: number) => void
  onOpen: () => void
  onDownload: () => void
  onReset: () => void
}

function IconButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`pte-icon${pressed ? ' is-on' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Toolbar({ fileLabel, tool, zoom, onTool, onZoom, onOpen, onDownload, onReset }: ToolbarProps) {
  return (
    <div className="pte-toolbar" role="toolbar" aria-label="PDF text editing">
      <div className="pte-toolbar-group">
        <button type="button" className="pte-text-button" onClick={onOpen}>
          Open
        </button>
        <button type="button" className="pte-text-button pte-primary" onClick={onDownload}>
          Download PDF
        </button>
        <button type="button" className="pte-text-button" onClick={onReset}>
          Reset
        </button>
      </div>
      <span className="pte-file" title={fileLabel}>
        {fileLabel}
      </span>
      <div className="pte-toolbar-group">
        <label className="pte-zoom">
          <span className="pte-sr">Zoom</span>
          <select value={String(Math.round(zoom * 100))} onChange={(event) => onZoom(Number(event.target.value) / 100)} aria-label="Zoom">
            {zoomStops(zoom).map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
        <IconButton label="Zoom out" onClick={() => onZoom(Math.max(0.4, zoom / 1.1))}>
          −
        </IconButton>
        <IconButton label="Zoom in" onClick={() => onZoom(Math.min(3, zoom * 1.1))}>
          +
        </IconButton>
      </div>
      <div className="pte-toolbar-group">
        <IconButton label="Pan" pressed={tool === 'pan'} onClick={() => onTool('pan')}>
          <PanIcon />
        </IconButton>
        <IconButton label="Select" pressed={tool === 'select'} onClick={() => onTool('select')}>
          <SelectIcon />
        </IconButton>
        <IconButton label="Edit Text" pressed={tool === 'edit-text'} onClick={() => onTool('edit-text')}>
          <TypeIcon />
        </IconButton>
      </div>
      <div className="pte-toolbar-group">
        <IconButton label="Add Paragraph" pressed={tool === 'add-paragraph'} onClick={() => onTool('add-paragraph')}>
          <ParagraphIcon />
        </IconButton>
        <IconButton label="New Image" pressed={tool === 'add-image'} onClick={() => onTool('add-image')}>
          <ImageIcon />
        </IconButton>
      </div>
    </div>
  )
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3l7 16 2-6 6-2L5 3z" />
    </svg>
  )
}

function TypeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M12 6v12M8 18h8" />
    </svg>
  )
}

function ParagraphIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5h7a4 4 0 0 1 0 8H8zM8 5v14" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M7 15l3-3 2 2 3-4 2 5" />
    </svg>
  )
}
