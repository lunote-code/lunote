import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

import { prepareCodeBlockCmExitForOutsideClick } from '../boundary/codeBlockBoundaryRegistry'
import { isCodeBlockCmMouseTarget, isCodeBlockToolbarDom } from './codeBlockCmDom'
import { needsCodeBlockCmOutsideClickRelease, releaseCodeBlockCmForOutsidePointer } from './codeBlockCmPmFocusReconcile'

function shouldReleasePmForPointerTarget(target: EventTarget | null, event: MouseEvent): boolean {
  if (!(target instanceof HTMLElement)) return true
  if (isCodeBlockCmMouseTarget(target, event.clientX, event.clientY)) return false
  if (isCodeBlockToolbarDom(target)) return false
  return true
}

/**
 * While CM owns a code block, PM root is contenteditable=false (WebKit nested editables).
 * Restore it synchronously on mousedown outside the CM surface so the click can place
 * the caret in body text above/below without waiting for blur timers.
 */
export function installCodeBlockCmPmClickExit(
  editor: Editor,
  view: EditorView,
): () => void {
  const pmDom = view.dom

  const onMouseDownCapture = (event: MouseEvent) => {
    if (event.button !== 0) return
    if (
      needsCodeBlockCmOutsideClickRelease(pmDom, editor) &&
      shouldReleasePmForPointerTarget(event.target, event)
    ) {
      prepareCodeBlockCmExitForOutsideClick(view)
      releaseCodeBlockCmForOutsidePointer(editor, pmDom)
    }
  }

  pmDom.addEventListener('mousedown', onMouseDownCapture, true)
  return () => {
    pmDom.removeEventListener('mousedown', onMouseDownCapture, true)
  }
}
