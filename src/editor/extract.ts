import type { TextContent } from 'pdfjs-dist/types/src/display/api'
import type { FontFamily, TextBlock, TextSnapshot } from './types'

type RawItem = {
  str: string
  x: number
  baseline: number
  width: number
  fontSize: number
  fontFamily: FontFamily
  bold: boolean
  italic: boolean
}

type Line = {
  items: RawItem[]
  x: number
  baseline: number
  width: number
  fontSize: number
  fontFamily: FontFamily
  bold: boolean
  italic: boolean
  text: string
}

let sequence = 0

function nextId(): string {
  sequence += 1
  return `text-${sequence}`
}

function mapFamily(name: string): FontFamily {
  const value = name.toLowerCase()
  if (value.includes('courier') || value.includes('mono')) return 'courier'
  if (value.includes('times') || value.includes('roman') || value.includes('georgia')) return 'times'
  return 'helvetica'
}

function isTextItem(item: TextContent['items'][number]): item is Extract<TextContent['items'][number], { str: string }> {
  return 'str' in item
}

function joinLine(items: RawItem[]): string {
  let text = ''
  let cursor = items[0]?.x ?? 0
  for (const item of items) {
    if (text) {
      const gap = item.x - cursor
      if (gap > Math.max(1.5, item.fontSize * 0.18)) text += ' '
    }
    text += item.str
    cursor = item.x + item.width
  }
  return text.trim()
}

function lineBox(items: RawItem[]): Line | null {
  const text = joinLine(items)
  if (!text) return null
  const x = Math.min(...items.map((item) => item.x))
  const right = Math.max(...items.map((item) => item.x + item.width))
  const fontSize = Math.max(...items.map((item) => item.fontSize))
  const head = items[0]
  return {
    items,
    x,
    baseline: head.baseline,
    width: Math.max(8, right - x),
    fontSize,
    fontFamily: head.fontFamily,
    bold: items.some((item) => item.bold),
    italic: items.some((item) => item.italic),
    text,
  }
}

function snapshotFor(lines: Line[]): TextSnapshot {
  const first = lines[0]
  const last = lines[lines.length - 1]
  const x = Math.min(...lines.map((line) => line.x))
  const right = Math.max(...lines.map((line) => line.x + line.width))
  const top = first.baseline + first.fontSize * 0.82
  const bottom = last.baseline - last.fontSize * 0.28
  return {
    x,
    y: bottom,
    width: Math.max(24, right - x + 4),
    height: Math.max(first.fontSize, top - bottom),
    text: lines.map((line) => line.text).join(' '),
    fontSize: first.fontSize,
    fontFamily: first.fontFamily,
    bold: first.bold,
    italic: first.italic,
    underline: false,
    strike: false,
    align: 'left',
    color: '#1c2430',
  }
}

function sameParagraph(previous: Line, line: Line): boolean {
  if (Math.abs(previous.fontSize - line.fontSize) > 1.5) return false
  if (previous.fontFamily !== line.fontFamily) return false
  if (Math.abs(previous.x - line.x) > 18) return false
  const previousBottom = previous.baseline - previous.fontSize * 0.28
  const lineTop = line.baseline + line.fontSize * 0.82
  const gap = previousBottom - lineTop
  return gap < previous.fontSize * 0.65 && gap > -previous.fontSize * 0.35
}

export function clusterText(content: TextContent, pageIndex: number): TextBlock[] {
  const raw: RawItem[] = []
  for (const item of content.items) {
    if (!isTextItem(item) || !item.str.trim()) continue
    const fontSize = Math.hypot(item.transform[2], item.transform[3]) || item.height || 12
    const styleName = content.styles[item.fontName]?.fontFamily ?? item.fontName
    const style = `${styleName} ${item.fontName}`
    raw.push({
      str: item.str,
      x: item.transform[4],
      baseline: item.transform[5],
      width: item.width,
      fontSize,
      fontFamily: mapFamily(style),
      bold: /bold/i.test(style),
      italic: /italic|oblique/i.test(style),
    })
  }

  raw.sort((a, b) => b.baseline - a.baseline || a.x - b.x)
  const lines: Line[] = []
  let bucket: RawItem[] = []
  const flush = () => {
    const line = lineBox(bucket)
    if (line) lines.push(line)
    bucket = []
  }

  for (const item of raw) {
    const anchor = bucket[0]
    const sameLine = anchor && Math.abs(anchor.baseline - item.baseline) <= Math.max(2, item.fontSize * 0.35)
    if (!sameLine && bucket.length > 0) flush()
    bucket.push(item)
  }
  flush()

  const groups: Line[][] = []
  for (const line of lines) {
    const current = groups[groups.length - 1]
    const previous = current?.[current.length - 1]
    if (previous && sameParagraph(previous, line)) current.push(line)
    else groups.push([line])
  }

  return groups.map((group, index) => {
    const shot = snapshotFor(group)
    return {
      ...shot,
      id: nextId(),
      pageIndex,
      z: index + 1,
      removed: false,
      original: { ...shot },
    }
  })
}
