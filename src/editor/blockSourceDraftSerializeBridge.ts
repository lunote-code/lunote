import type { Editor } from '@tiptap/core'

type BlockSourceDraftFlush = () => void

const flushByEditor = new WeakMap<Editor, Set<BlockSourceDraftFlush>>()

export function registerBlockSourceDraftSerializeFlush(
  editor: Editor,
  flush: BlockSourceDraftFlush,
): () => void {
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

/** Commit open HTML / image syntax / math quick-edit drafts before markdown serialize or mode switch. */
export function flushAllBlockSourceDraftsForSerialize(editor: Editor): void {
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
