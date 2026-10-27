export type FontFamily = 'helvetica' | 'times' | 'courier'

export type Align = 'left' | 'center' | 'right'

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type Tool = 'edit-text' | 'select' | 'pan' | 'add-paragraph' | 'add-image'

export type PdfRect = {
  x: number
  y: number
  width: number
  height: number
}

export type TextSnapshot = PdfRect & {
  text: string
  fontSize: number
  fontFamily: FontFamily
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  align: Align
  color: string
}

export type TextBlock = TextSnapshot & {
  id: string
  pageIndex: number
  z: number
  removed: boolean
  original: TextSnapshot | null
}

export type ImageKind = 'png' | 'jpg'

export type ImageBlock = PdfRect & {
  id: string
  pageIndex: number
  z: number
  dataUrl: string
  bytes: Uint8Array
  kind: ImageKind
}

export type EditorModel = {
  blocks: TextBlock[]
  images: ImageBlock[]
}

export const emptyModel = (): EditorModel => ({ blocks: [], images: [] })
