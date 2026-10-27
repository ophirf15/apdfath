import type { EditorModel, TextBlock } from './types'

export function isDirty(block: TextBlock): boolean {
  if (block.removed) return true
  const original = block.original
  if (!original) return true
  return (
    block.text !== original.text ||
    Math.abs(block.x - original.x) > 0.4 ||
    Math.abs(block.y - original.y) > 0.4 ||
    Math.abs(block.width - original.width) > 0.4 ||
    Math.abs(block.height - original.height) > 0.4 ||
    Math.abs(block.fontSize - original.fontSize) > 0.2 ||
    block.bold !== original.bold ||
    block.italic !== original.italic ||
    block.underline !== original.underline ||
    block.strike !== original.strike ||
    block.align !== original.align ||
    block.color.toLowerCase() !== original.color.toLowerCase() ||
    block.fontFamily !== original.fontFamily
  )
}

export function maxZ(model: EditorModel): number {
  const values = [...model.blocks.map((block) => block.z), ...model.images.map((image) => image.z)]
  return values.length > 0 ? Math.max(...values) : 0
}

type StackKind = 'text' | 'image'

type OrderMode = 'front' | 'back' | 'forward' | 'backward'

export function reorder(model: EditorModel, id: string, mode: OrderMode): EditorModel {
  const items: { id: string; kind: StackKind }[] = [
    ...model.blocks.filter((block) => !block.removed).map((block) => ({ id: block.id, kind: 'text' as const, z: block.z })),
    ...model.images.map((image) => ({ id: image.id, kind: 'image' as const, z: image.z })),
  ]
    .sort((a, b) => a.z - b.z)
    .map(({ id: itemId, kind }) => ({ id: itemId, kind }))

  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return model

  const next = [...items]
  switch (mode) {
    case 'front': {
      const [item] = next.splice(index, 1)
      next.push(item)
      break
    }
    case 'back': {
      const [item] = next.splice(index, 1)
      next.unshift(item)
      break
    }
    case 'forward': {
      if (index < next.length - 1) {
        const swap = next[index + 1]
        next[index + 1] = next[index]
        next[index] = swap
      }
      break
    }
    case 'backward': {
      if (index > 0) {
        const swap = next[index - 1]
        next[index - 1] = next[index]
        next[index] = swap
      }
      break
    }
    default: {
      const neverMode: never = mode
      return neverMode
    }
  }

  const zOf = new Map(next.map((item, itemIndex) => [item.id, itemIndex + 1]))
  return {
    blocks: model.blocks.map((block) => (zOf.has(block.id) ? { ...block, z: zOf.get(block.id) ?? block.z } : block)),
    images: model.images.map((image) => ({ ...image, z: zOf.get(image.id) ?? image.z })),
  }
}

export function patchBlock(model: EditorModel, id: string, patch: Partial<TextBlock>): EditorModel {
  return {
    ...model,
    blocks: model.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
  }
}
