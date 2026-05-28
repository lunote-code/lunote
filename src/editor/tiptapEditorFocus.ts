import type { Editor } from '@tiptap/core'

const TI_FOCUS_NO_SCROLL = { scrollIntoView: false as const }

/** Focus PM: Single `focus(scrollIntoView:false)` to avoid rAF / preventScroll superposition causing double focus and false cursor*/
export function focusTiptapProseMirrorSurface(ed: Editor): void {
  try {
    ed.commands.focus(undefined, TI_FOCUS_NO_SCROLL)
  } catch {
    /* ignore */
  }
}
