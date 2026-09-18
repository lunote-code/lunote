import type { Editor } from '@tiptap/core'

type DrawingSerializeFlush = () => void

const flushByEditor = new WeakMap<Editor, Set<DrawingSerializeFlush>>()

export function registerDrawingSerializeFlush(editor: Editor, flush: DrawingSerializeFlush): () => void {
  let set = flushByEditor.get(editor)
  if (!set) {
    set = new Set()
    flushByEditor.set(editor, set)
  }
  set.add(flush)
  return () => {
    set!.delete(flush)
    if (set!.size === 0) flushByEditor.delete(editor)
  }
}

/** Commit in-progress drawing strokes / viewport before markdown serialize or mode switch. */
export function flushAllDrawingBlocksForSerialize(editor: Editor): void {
  const set = flushByEditor.get(editor)
  if (!set) return
  for (const flush of [...set]) {
    try {
      flush()
    } catch {
      // NodeView may be mid-unmount during document switch.
    }
  }
}
