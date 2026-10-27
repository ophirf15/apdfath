import { useCallback, useRef, useState } from 'react'
import { emptyModel, type EditorModel } from './types'

function cloneModel(model: EditorModel): EditorModel {
  return structuredClone(model)
}

export function useHistory(initial: EditorModel = emptyModel()) {
  const [present, setPresent] = useState(initial)
  const pastRef = useRef<EditorModel[]>([])
  const futureRef = useRef<EditorModel[]>([])
  const presentRef = useRef(present)
  const [revision, setRevision] = useState(0)
  presentRef.current = present

  const bump = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const reset = useCallback(
    (model: EditorModel) => {
      pastRef.current = []
      futureRef.current = []
      presentRef.current = model
      setPresent(model)
      bump()
    },
    [bump],
  )

  const commit = useCallback(
    (recipe: (model: EditorModel) => EditorModel) => {
      const current = presentRef.current
      const next = recipe(current)
      pastRef.current = [...pastRef.current, cloneModel(current)].slice(-60)
      futureRef.current = []
      presentRef.current = next
      setPresent(next)
      bump()
    },
    [bump],
  )

  const undo = useCallback(() => {
    const past = pastRef.current
    if (past.length === 0) return
    const previous = past[past.length - 1]
    pastRef.current = past.slice(0, -1)
    futureRef.current = [cloneModel(presentRef.current), ...futureRef.current]
    presentRef.current = previous
    setPresent(previous)
    bump()
  }, [bump])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (future.length === 0) return
    const next = future[0]
    futureRef.current = future.slice(1)
    pastRef.current = [...pastRef.current, cloneModel(presentRef.current)]
    presentRef.current = next
    setPresent(next)
    bump()
  }, [bump])

  return {
    present,
    revision,
    commit,
    reset,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  }
}
