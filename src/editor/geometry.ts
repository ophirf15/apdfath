import type { FontFamily, PdfRect, ResizeHandle } from './types'

export const LINE_HEIGHT = 1.35

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function cssFamily(family: FontFamily): string {
  switch (family) {
    case 'helvetica':
      return 'Helvetica, Arial, sans-serif'
    case 'times':
      return '"Times New Roman", Times, serif'
    case 'courier':
      return '"Courier New", Courier, monospace'
    default: {
      const neverFamily: never = family
      return neverFamily
    }
  }
}

export function applyResize(rect: PdfRect, handle: ResizeHandle, dx: number, dy: number): PdfRect {
  let { x, y, width, height } = rect
  const minW = 36
  const minH = 16
  const right = x + width
  const top = y + height

  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    width = Math.max(minW, width + dx)
  }
  if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    const nextX = Math.min(x + dx, right - minW)
    width = right - nextX
    x = nextX
  }
  if (handle === 'n' || handle === 'ne' || handle === 'nw') {
    const nextTop = Math.max(top + dy, y + minH)
    height = nextTop - y
  }
  if (handle === 's' || handle === 'se' || handle === 'sw') {
    const nextY = Math.min(y + dy, top - minH)
    height = top - nextY
    y = nextY
  }

  return { x, y, width, height }
}

let measureContext: CanvasRenderingContext2D | null = null

export function textWidth(
  text: string,
  family: FontFamily,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): number {
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) return text.length * fontSize * 0.5
  const weight = bold ? 'bold ' : ''
  const style = italic ? 'italic ' : ''
  measureContext.font = `${style}${weight}${fontSize}px ${cssFamily(family)}`
  return measureContext.measureText(text).width
}

export function wrapText(
  text: string,
  maxWidth: number,
  widthOf: (line: string) => number,
): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && widthOf(next) > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines.length > 0 ? lines : ['']
}
