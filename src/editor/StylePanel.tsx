import { reorder } from './model'
import type { Align, FontFamily, TextBlock } from './types'

const SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48]

type StylePanelProps = {
  selected: TextBlock | null
  imageSelected: boolean
  canUndo: boolean
  canRedo: boolean
  onChange: (patch: Partial<TextBlock>) => void
  onOrder: (mode: Parameters<typeof reorder>[2]) => void
  onUndo: () => void
  onRedo: () => void
  onEdit: () => void
}

export function StylePanel({
  selected,
  imageSelected,
  canUndo,
  canRedo,
  onChange,
  onOrder,
  onUndo,
  onRedo,
  onEdit,
}: StylePanelProps) {
  const disabled = !selected
  return (
    <aside className="pte-styles" aria-label="Text styles">
      <h2>Text styles</h2>
      <p className="pte-hint">
        Double-click outlined text to edit it. Drag a box to move it, or drag a handle to resize it.
      </p>
      <button type="button" className="pte-text-button pte-wide" disabled={!selected && !imageSelected} onClick={onEdit}>
        Edit content
      </button>
      <label className="pte-field">
        Font
        <select
          aria-label="Font family"
          disabled={disabled}
          value={selected?.fontFamily ?? 'helvetica'}
          onChange={(event) => onChange({ fontFamily: event.target.value as FontFamily })}
        >
          <option value="helvetica">Helvetica</option>
          <option value="times">Times</option>
          <option value="courier">Courier</option>
        </select>
      </label>
      <label className="pte-field">
        Size
        <select
          aria-label="Font size"
          disabled={disabled}
          value={selected ? String(Math.round(selected.fontSize)) : '12'}
          onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="pte-style-row" role="group" aria-label="Character style">
        <StyleToggle label="Bold" disabled={disabled} pressed={selected?.bold ?? false} onClick={() => selected && onChange({ bold: !selected.bold })}>
          B
        </StyleToggle>
        <StyleToggle label="Italic" disabled={disabled} pressed={selected?.italic ?? false} onClick={() => selected && onChange({ italic: !selected.italic })}>
          I
        </StyleToggle>
        <StyleToggle label="Underline" disabled={disabled} pressed={selected?.underline ?? false} onClick={() => selected && onChange({ underline: !selected.underline })}>
          U
        </StyleToggle>
        <StyleToggle label="Strikeout" disabled={disabled} pressed={selected?.strike ?? false} onClick={() => selected && onChange({ strike: !selected.strike })}>
          S
        </StyleToggle>
      </div>
      <div className="pte-style-row" role="group" aria-label="Alignment">
        <StyleToggle label="Align left" disabled={disabled} pressed={selected?.align === 'left'} onClick={() => onChange({ align: 'left' satisfies Align })}>
          L
        </StyleToggle>
        <StyleToggle label="Align center" disabled={disabled} pressed={selected?.align === 'center'} onClick={() => onChange({ align: 'center' })}>
          C
        </StyleToggle>
        <StyleToggle label="Align right" disabled={disabled} pressed={selected?.align === 'right'} onClick={() => onChange({ align: 'right' })}>
          R
        </StyleToggle>
      </div>
      <label className="pte-field pte-color">
        Color
        <input
          aria-label="Text color"
          type="color"
          disabled={disabled}
          value={selected?.color ?? '#1c2430'}
          onChange={(event) => onChange({ color: event.target.value })}
        />
      </label>
      <h3>Order</h3>
      <div className="pte-style-row">
        <button type="button" disabled={!selected && !imageSelected} onClick={() => onOrder('back')}>
          Send to back
        </button>
        <button type="button" disabled={!selected && !imageSelected} onClick={() => onOrder('backward')}>
          Backward
        </button>
        <button type="button" disabled={!selected && !imageSelected} onClick={() => onOrder('forward')}>
          Forward
        </button>
        <button type="button" disabled={!selected && !imageSelected} onClick={() => onOrder('front')}>
          Bring to front
        </button>
      </div>
      <div className="pte-style-row">
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" disabled={!canRedo} onClick={onRedo}>
          Redo
        </button>
      </div>
    </aside>
  )
}

function StyleToggle({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} title={label} disabled={disabled} className={pressed ? 'is-on' : ''} onClick={onClick}>
      {children}
    </button>
  )
}
